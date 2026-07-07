package admin

import (
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/invopop/jsonschema"
)

// TableColumnOptions tunes ModelToTableColumns output.
type TableColumnOptions struct {
	// ExcludeFields lists JSON field names to leave out of the table.
	ExcludeFields []string
	// LinkPattern maps JSON field names to link templates,
	// e.g. "id": "/admin/posts/{id}".
	LinkPattern map[string]string
}

type fieldInfo struct {
	JSONName  string
	Label     string
	Type      string
	Format    string // from jsonschema tag (date-time, uri, ...)
	Order     int
	Width     int
	Pinned    bool
	TableFmt  string // from table tag format=
	ValueFrom string // from table tag valuefrom=
}

// ModelToTableColumns reflects a struct into table columns for the list view.
// Field properties come from struct tags:
//   - json: wire name (fields without one are skipped)
//   - jsonschema: title, format, etc. (invopop/jsonschema vocabulary)
//   - table: semicolon-separated column settings:
//     order=N (default 999), width=px, format=<image|chip|color|wallet-address|...>,
//     valuefrom={{.Rel.Field}}, pinned=true, omit
//
// Example: `table:"order=1;width=100;format=image;pinned=true"`
func ModelToTableColumns(model any, options *TableColumnOptions) ([]TableColumn, error) {
	if options == nil {
		options = &TableColumnOptions{}
	}

	t := reflect.TypeOf(model)
	if t != nil && t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t == nil || t.Kind() != reflect.Struct {
		return nil, fmt.Errorf("model must be a struct or pointer to struct")
	}

	schema := reflectSchema(model)

	infos, err := extractFieldInfos(t, schema)
	if err != nil {
		return nil, err
	}

	for _, fi := range infos {
		if fi.ValueFrom != "" {
			if err := validateTemplateFields(fi.ValueFrom, t, fi.JSONName); err != nil {
				return nil, err
			}
		}
	}

	sort.SliceStable(infos, func(i, j int) bool { return infos[i].Order < infos[j].Order })

	exclude := make(map[string]bool, len(options.ExcludeFields))
	for _, f := range options.ExcludeFields {
		exclude[f] = true
	}

	columns := make([]TableColumn, 0, len(infos))
	for _, fi := range infos {
		if exclude[fi.JSONName] {
			continue
		}
		col := TableColumn{
			Name:      fi.JSONName,
			Label:     fi.Label,
			Type:      mapTypeToColumnType(fi.Type),
			Pinned:    fi.Pinned,
			Width:     fi.Width,
			ValueFrom: fi.ValueFrom,
		}
		if fi.TableFmt != "" {
			col.Format = fi.TableFmt
		} else {
			col.Format = mapFormatToColumnFormat(fi.Format)
		}
		if pattern, ok := options.LinkPattern[fi.JSONName]; ok {
			col.Link = pattern
		}
		columns = append(columns, col)
	}
	return columns, nil
}

// reflectSchema runs invopop reflection and inlines nested definitions so RJSF
// receives self-contained object schemas for arrays and nested structs.
func reflectSchema(model any) *jsonschema.Schema {
	r := &jsonschema.Reflector{DoNotReference: true}
	return r.Reflect(model)
}

func extractFieldInfos(t reflect.Type, schema *jsonschema.Schema) ([]fieldInfo, error) {
	props := make(map[string]*jsonschema.Schema)
	if schema.Properties != nil {
		for pair := schema.Properties.Oldest(); pair != nil; pair = pair.Next() {
			props[pair.Key] = pair.Value
		}
	}

	infos := make([]fieldInfo, 0, t.NumField())
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

		order, width, format, valueFrom, pinned, omit := parseTableTag(field.Tag.Get("table"))
		if omit {
			continue
		}

		prop, ok := props[jsonName]
		if !ok {
			continue
		}

		fi := fieldInfo{
			JSONName:  jsonName,
			Label:     prop.Title,
			Type:      prop.Type,
			Format:    prop.Format,
			Order:     order,
			Width:     width,
			Pinned:    pinned,
			TableFmt:  format,
			ValueFrom: valueFrom,
		}
		if fi.Label == "" {
			fi.Label = humanizeFieldName(field.Name)
		}
		infos = append(infos, fi)
	}
	return infos, nil
}

// parseTableTag parses `table:"order=1;width=100;format=image;valuefrom={{.User.Name}};pinned=true;omit"`.
func parseTableTag(tag string) (order, width int, format, valueFrom string, pinned, omit bool) {
	order = 999
	if tag == "" {
		return
	}
	for _, part := range strings.Split(tag, ";") {
		part = strings.TrimSpace(part)
		if part == "omit" {
			omit = true
			continue
		}
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key, value := strings.TrimSpace(kv[0]), strings.TrimSpace(kv[1])
		switch key {
		case "order":
			if o, err := strconv.Atoi(value); err == nil {
				order = o
			}
		case "width":
			if w, err := strconv.Atoi(value); err == nil && w > 0 {
				width = w
			}
		case "format":
			format = value
		case "valuefrom":
			valueFrom = value
		case "pinned":
			pinned = value == "true"
		}
	}
	return
}

// humanizeFieldName converts CamelCase to "Camel Case", keeping acronyms
// together ("HTTPEndpoint" -> "HTTP Endpoint").
func humanizeFieldName(name string) string {
	var b strings.Builder
	prevUpper := false
	for i, r := range name {
		isUpper := 'A' <= r && r <= 'Z'
		if i > 0 && isUpper {
			if !prevUpper || (i+1 < len(name) && 'a' <= rune(name[i+1]) && rune(name[i+1]) <= 'z') {
				b.WriteByte(' ')
			}
		}
		b.WriteRune(r)
		prevUpper = isUpper
	}
	return b.String()
}

func mapTypeToColumnType(jsonType string) string {
	switch jsonType {
	case "number", "integer":
		return "number"
	case "boolean", "array", "object":
		return jsonType
	default:
		return "string"
	}
}

func mapFormatToColumnFormat(format string) string {
	switch format {
	case "date-time", "date", "time", "email", "tel":
		return format
	case "url", "uri":
		return "url"
	default:
		return ""
	}
}

var templateFieldRe = regexp.MustCompile(`\{\{\.([^}]+)\}\}`)

// validateTemplateFields checks every {{.A.B}} reference in a valuefrom
// template against the struct so typos fail at startup.
func validateTemplateFields(template string, structType reflect.Type, fieldName string) error {
	for _, match := range templateFieldRe.FindAllStringSubmatch(template, -1) {
		if len(match) > 1 {
			if err := validateFieldPath(match[1], structType); err != nil {
				return fmt.Errorf("invalid valuefrom template in field %s: %w", fieldName, err)
			}
		}
	}
	return nil
}

func validateFieldPath(path string, structType reflect.Type) error {
	parts := strings.Split(path, ".")
	current := structType
	for i, part := range parts {
		if current.Kind() == reflect.Pointer {
			current = current.Elem()
		}
		if current.Kind() != reflect.Struct {
			return fmt.Errorf("cannot access field %s on non-struct type %s", part, current.String())
		}
		field, found := findField(current, part)
		if !found {
			return fmt.Errorf("field %s not found in %s", part, current.String())
		}
		if i == len(parts)-1 {
			break
		}
		current = field.Type
	}
	return nil
}

// findField looks up a struct field by Go name, falling back to JSON tag name.
func findField(structType reflect.Type, name string) (reflect.StructField, bool) {
	for i := 0; i < structType.NumField(); i++ {
		if structType.Field(i).Name == name {
			return structType.Field(i), true
		}
	}
	for i := 0; i < structType.NumField(); i++ {
		jsonTag := structType.Field(i).Tag.Get("json")
		if jsonTag != "" && strings.Split(jsonTag, ",")[0] == name {
			return structType.Field(i), true
		}
	}
	return reflect.StructField{}, false
}
