package admin

import (
	"testing"
	"time"
)

type sampleAuthor struct {
	Name string `json:"name"`
}

type sampleModel struct {
	ID        uint         `json:"id" jsonschema:"title=ID" table:"order=0;pinned=true"`
	Name      string       `json:"name" jsonschema:"title=Name" table:"order=1;width=200"`
	AvatarURL string       `json:"avatarUrl" jsonschema:"title=Avatar" table:"order=2;format=image"`
	Status    string       `json:"status" jsonschema:"title=Status,enum=draft,enum=published" table:"order=3;format=chip"`
	Color     string       `json:"color" table:"order=4;format=color"`
	Website   string       `json:"website" jsonschema:"format=uri" table:"order=5"`
	CreatedAt time.Time    `json:"createdAt" jsonschema:"title=Created" table:"order=6"`
	Author    sampleAuthor `json:"author" table:"order=7;valuefrom={{.Author.Name}}"`
	Secret    string       `json:"secret" table:"omit"`
	Internal  string       `json:"-"`
}

type sampleRule struct {
	Name   string `json:"name" jsonschema:"title=Name"`
	Action string `json:"action" jsonschema:"title=Action,enum=allow,enum=deny"`
}

type sampleArrayObjectForm struct {
	Rules []sampleRule `json:"rules" jsonschema:"title=Rules"`
}

func TestReflectSchema_InlinesArrayObjectItems(t *testing.T) {
	schema := reflectSchema(sampleArrayObjectForm{})
	rules, ok := schema.Properties.Get("rules")
	if !ok {
		t.Fatal("rules property missing")
	}
	if rules.Type != "array" {
		t.Fatalf("rules type = %q, want array", rules.Type)
	}
	if rules.Items == nil {
		t.Fatal("rules items missing")
	}
	if rules.Items.Ref != "" {
		t.Fatalf("rules items ref = %q, want inlined object schema", rules.Items.Ref)
	}
	if rules.Items.Type != "object" {
		t.Fatalf("rules items type = %q, want object", rules.Items.Type)
	}
	if _, ok := rules.Items.Properties.Get("name"); !ok {
		t.Fatal("rules item name property missing")
	}
	if action, ok := rules.Items.Properties.Get("action"); !ok {
		t.Fatal("rules item action property missing")
	} else if len(action.Enum) != 2 {
		t.Fatalf("rules item action enum len = %d, want 2", len(action.Enum))
	}
}

func TestModelToTableColumns(t *testing.T) {
	cols, err := ModelToTableColumns(&sampleModel{}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// omit + json:"-" fields excluded.
	if len(cols) != 8 {
		t.Fatalf("expected 8 columns, got %d: %+v", len(cols), cols)
	}

	// Ordered by table order.
	wantOrder := []string{"id", "name", "avatarUrl", "status", "color", "website", "createdAt", "author"}
	for i, want := range wantOrder {
		if cols[i].Name != want {
			t.Errorf("column %d: want %q, got %q", i, want, cols[i].Name)
		}
	}

	byName := map[string]TableColumn{}
	for _, c := range cols {
		byName[c.Name] = c
	}

	if !byName["id"].Pinned {
		t.Error("id should be pinned")
	}
	if byName["name"].Width != 200 {
		t.Errorf("name width: want 200, got %d", byName["name"].Width)
	}
	if byName["name"].Label != "Name" {
		t.Errorf("name label: want Name, got %q", byName["name"].Label)
	}
	if byName["avatarUrl"].Format != "image" {
		t.Errorf("avatarUrl format: want image, got %q", byName["avatarUrl"].Format)
	}
	if byName["status"].Format != "chip" {
		t.Errorf("status format: want chip, got %q", byName["status"].Format)
	}
	if byName["color"].Format != "color" {
		t.Errorf("color format: want color, got %q", byName["color"].Format)
	}
	// jsonschema format=uri maps to url when no table format override.
	if byName["website"].Format != "url" {
		t.Errorf("website format: want url, got %q", byName["website"].Format)
	}
	if byName["createdAt"].Format != "date-time" {
		t.Errorf("createdAt format: want date-time, got %q", byName["createdAt"].Format)
	}
	if byName["author"].ValueFrom != "{{.Author.Name}}" {
		t.Errorf("author valueFrom: want {{.Author.Name}}, got %q", byName["author"].ValueFrom)
	}
	// Humanized label fallback (no jsonschema title on color).
	if byName["color"].Label != "Color" {
		t.Errorf("color label: want Color, got %q", byName["color"].Label)
	}
}

func TestModelToTableColumns_ExcludeAndLink(t *testing.T) {
	cols, err := ModelToTableColumns(&sampleModel{}, &TableColumnOptions{
		ExcludeFields: []string{"color"},
		LinkPattern:   map[string]string{"name": "/admin/posts/{id}"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, c := range cols {
		if c.Name == "color" {
			t.Error("color should be excluded")
		}
		if c.Name == "name" && c.Link != "/admin/posts/{id}" {
			t.Errorf("name link: got %q", c.Link)
		}
	}
}

type badTemplate struct {
	ID     uint   `json:"id"`
	Broken string `json:"broken" table:"valuefrom={{.DoesNotExist.Field}}"`
}

func TestModelToTableColumns_InvalidTemplate(t *testing.T) {
	_, err := ModelToTableColumns(&badTemplate{}, nil)
	if err == nil {
		t.Fatal("expected error for invalid valuefrom template")
	}
}

func TestHumanizeFieldName(t *testing.T) {
	cases := map[string]string{
		"Name":         "Name",
		"CreatedAt":    "Created At",
		"HTTPEndpoint": "HTTP Endpoint",
		"URL":          "URL",
		"UserID":       "User ID",
	}
	for in, want := range cases {
		if got := humanizeFieldName(in); got != want {
			t.Errorf("humanizeFieldName(%q): want %q, got %q", in, want, got)
		}
	}
}
