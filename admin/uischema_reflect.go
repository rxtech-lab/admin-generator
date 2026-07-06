package admin

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// UISchema is a react-jsonschema-form uiSchema document.
type UISchema map[string]any

// uiSchemaField is the parsed form of one uischema struct tag.
type uiSchemaField struct {
	Widget    string
	Options   map[string]any
	Help      string
	Disabled  bool
	Readonly  bool
	Autofocus bool
	ClassName string
	Items     *uiSchemaField
}

// ParseUISchemaTag parses a uischema struct tag into uiSchema entries.
// Semicolon-separated key=value pairs:
//
//	`uischema:"widget=textarea;rows=4;placeholder=Enter description;readonly=true"`
//
// Keys widget/type, help, disabled, readonly, autofocus, classname are special;
// everything else lands in ui:options. An explicit "ui:options:" prefix is also
// supported: `uischema:"widget=ForeignKey;ui:options:resource=networks"`.
func parseUISchemaTag(tag string) (*uiSchemaField, error) {
	if tag == "" || tag == "-" {
		return nil, nil
	}
	field := &uiSchemaField{Options: make(map[string]any)}
	for _, pair := range strings.Split(tag, ";") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid uischema tag format: %s", pair)
		}
		key, value := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
		switch key {
		case "type", "widget":
			field.Widget = value
		case "help":
			field.Help = value
		case "disabled":
			field.Disabled = parseBool(value)
		case "readonly":
			field.Readonly = parseBool(value)
		case "autofocus":
			field.Autofocus = parseBool(value)
		case "classname":
			field.ClassName = value
		default:
			if optionKey, ok := strings.CutPrefix(key, "ui:options:"); ok {
				field.Options[optionKey] = parseValue(value)
			} else {
				field.Options[key] = parseValue(value)
			}
		}
	}
	return field, nil
}

func (f *uiSchemaField) toMap() map[string]any {
	m := make(map[string]any)
	if f.Widget != "" {
		m["ui:widget"] = f.Widget
	}
	if len(f.Options) > 0 {
		m["ui:options"] = f.Options
	}
	if f.Help != "" {
		m["ui:help"] = f.Help
	}
	if f.Disabled {
		m["ui:disabled"] = true
	}
	if f.Readonly {
		m["ui:readonly"] = true
	}
	if f.Autofocus {
		m["ui:autofocus"] = true
	}
	if f.ClassName != "" {
		m["ui:classNames"] = f.ClassName
	}
	if f.Items != nil {
		m["items"] = f.Items.toMap()
	}
	return m
}

// ModelToUISchema reflects a struct into an RJSF uiSchema using the
// `uischema:` tag per field and `uiSchemaItems:` for array element widgets.
// Nested structs (and slices of structs) without a uischema tag are recursed.
func ModelToUISchema(model any) (UISchema, error) {
	t := reflect.TypeOf(model)
	if t == nil {
		return nil, fmt.Errorf("model cannot be nil")
	}
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil, fmt.Errorf("model must be a struct or pointer to struct")
	}

	uiSchema := make(UISchema)
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		if !field.IsExported() {
			continue
		}
		jsonTag := field.Tag.Get("json")
		if jsonTag == "" || jsonTag == "-" {
			continue
		}
		jsonName := strings.Split(jsonTag, ",")[0]

		tag := field.Tag.Get("uischema")
		itemsTag := field.Tag.Get("uiSchemaItems")

		if tag != "" && tag != "-" {
			uiField, err := parseUISchemaTag(tag)
			if err != nil {
				return nil, fmt.Errorf("field %s: %w", field.Name, err)
			}
			if itemsTag != "" && itemsTag != "-" {
				itemsField, err := parseUISchemaTag(itemsTag)
				if err != nil {
					return nil, fmt.Errorf("field %s (uiSchemaItems): %w", field.Name, err)
				}
				uiField.Items = itemsField
			}
			uiSchema[jsonName] = uiField.toMap()
			continue
		}
		if itemsTag != "" && itemsTag != "-" {
			itemsField, err := parseUISchemaTag(itemsTag)
			if err != nil {
				return nil, fmt.Errorf("field %s (uiSchemaItems): %w", field.Name, err)
			}
			uiSchema[jsonName] = map[string]any{"items": itemsField.toMap()}
			continue
		}

		// No tags: recurse into nested structs / slices of structs.
		fieldType := field.Type
		if fieldType.Kind() == reflect.Ptr {
			fieldType = fieldType.Elem()
		}
		switch {
		case fieldType.Kind() == reflect.Slice || fieldType.Kind() == reflect.Array:
			elemType := fieldType.Elem()
			if elemType.Kind() == reflect.Ptr {
				elemType = elemType.Elem()
			}
			if elemType.Kind() == reflect.Struct && !isBasicType(elemType) {
				nested, err := ModelToUISchema(reflect.New(elemType).Elem().Interface())
				if err != nil {
					return nil, fmt.Errorf("array field %s: %w", field.Name, err)
				}
				if len(nested) > 0 {
					uiSchema[jsonName] = UISchema{"items": nested}
				}
			}
		case fieldType.Kind() == reflect.Struct && !isBasicType(fieldType):
			nested, err := ModelToUISchema(reflect.New(fieldType).Elem().Interface())
			if err != nil {
				return nil, fmt.Errorf("nested field %s: %w", field.Name, err)
			}
			if len(nested) > 0 {
				uiSchema[jsonName] = nested
			}
		}
	}
	return uiSchema, nil
}

// MergeUISchema merges uiSchemas left to right; later entries win, maps are
// merged shallowly per field.
func MergeUISchema(schemas ...UISchema) UISchema {
	result := make(UISchema)
	for _, schema := range schemas {
		for key, value := range schema {
			existingMap, ok1 := result[key].(map[string]any)
			valueMap, ok2 := value.(map[string]any)
			if ok1 && ok2 {
				merged := make(map[string]any, len(existingMap)+len(valueMap))
				for k, v := range existingMap {
					merged[k] = v
				}
				for k, v := range valueMap {
					merged[k] = v
				}
				result[key] = merged
				continue
			}
			result[key] = value
		}
	}
	return result
}

func parseBool(s string) bool {
	s = strings.ToLower(s)
	return s == "true" || s == "yes" || s == "1"
}

// parseValue coerces tag values into bool/int/float where unambiguous.
func parseValue(s string) any {
	lower := strings.ToLower(s)
	if lower == "true" || lower == "false" || lower == "yes" {
		return parseBool(s)
	}
	if lower == "nan" || lower == "infinity" || lower == "-infinity" || lower == "+infinity" {
		return s
	}
	if i, err := strconv.Atoi(s); err == nil {
		return i
	}
	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return f
	}
	return s
}

func isBasicType(t reflect.Type) bool {
	switch t.Kind() {
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64, reflect.Complex64, reflect.Complex128,
		reflect.String:
		return true
	case reflect.Struct:
		return t == reflect.TypeOf(time.Time{})
	default:
		return false
	}
}
