package admin

import (
	"reflect"
	"testing"
)

type sampleForm struct {
	Name        string   `json:"name" uischema:"placeholder=Enter name;autofocus=true"`
	Bio         string   `json:"bio" uischema:"widget=textarea;ui:options:rows=4"`
	AuthorID    int      `json:"authorId" uischema:"widget=ForeignKey;ui:options:resource=authors;ui:options:placeholder=Pick author"`
	Tags        []string `json:"tags" uiSchemaItems:"widget=ObjectSearch;ui:options:resource=tags"`
	Description string   `json:"description" uischema:"widget=textarea;readonly=true;help=Read only"`
}

func TestModelToUISchema(t *testing.T) {
	ui, err := ModelToUISchema(sampleForm{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	name := ui["name"].(map[string]any)
	opts := name["ui:options"].(map[string]any)
	if opts["placeholder"] != "Enter name" {
		t.Errorf("name placeholder: got %v", opts["placeholder"])
	}
	if name["ui:autofocus"] != true {
		t.Errorf("name autofocus: got %v", name["ui:autofocus"])
	}

	bio := ui["bio"].(map[string]any)
	if bio["ui:widget"] != "textarea" {
		t.Errorf("bio widget: got %v", bio["ui:widget"])
	}
	bioOpts := bio["ui:options"].(map[string]any)
	if bioOpts["rows"] != 4 {
		t.Errorf("bio rows: want int 4, got %#v", bioOpts["rows"])
	}

	author := ui["authorId"].(map[string]any)
	if author["ui:widget"] != "ForeignKey" {
		t.Errorf("authorId widget: got %v", author["ui:widget"])
	}
	authorOpts := author["ui:options"].(map[string]any)
	if authorOpts["resource"] != "authors" {
		t.Errorf("authorId resource: got %v", authorOpts["resource"])
	}

	tags := ui["tags"].(map[string]any)
	items := tags["items"].(map[string]any)
	if items["ui:widget"] != "ObjectSearch" {
		t.Errorf("tags items widget: got %v", items["ui:widget"])
	}

	desc := ui["description"].(map[string]any)
	if desc["ui:readonly"] != true {
		t.Errorf("description readonly: got %v", desc["ui:readonly"])
	}
	if desc["ui:help"] != "Read only" {
		t.Errorf("description help: got %v", desc["ui:help"])
	}
}

func TestMergeUISchema(t *testing.T) {
	base := UISchema{
		"name": map[string]any{"ui:widget": "text", "ui:help": "base"},
	}
	override := UISchema{
		"name": map[string]any{"ui:widget": "textarea"},
	}
	merged := MergeUISchema(base, override)
	got := merged["name"].(map[string]any)
	if got["ui:widget"] != "textarea" {
		t.Errorf("widget should be overridden: got %v", got["ui:widget"])
	}
	if got["ui:help"] != "base" {
		t.Errorf("help should be preserved: got %v", got["ui:help"])
	}
}

func TestParseValue(t *testing.T) {
	cases := []struct {
		in   string
		want any
	}{
		{"true", true},
		{"false", false},
		{"4", 4},
		{"3.14", 3.14},
		{"hello", "hello"},
	}
	for _, c := range cases {
		if got := parseValue(c.in); !reflect.DeepEqual(got, c.want) {
			t.Errorf("parseValue(%q): want %#v, got %#v", c.in, c.want, got)
		}
	}
}
