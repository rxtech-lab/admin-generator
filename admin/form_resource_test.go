package admin

import (
	"context"
	"testing"
)

type configForm struct {
	DefaultHostModel string `json:"default_host_model" jsonschema:"title=Default model"`
}

func TestNewFormResource(t *testing.T) {
	var acted map[string]any
	res := NewFormResource(FormResourceConfig{
		ID:   "app-config",
		Name: "App Config",
		Icon: "settings",
		Schema: func(_ context.Context, req Request, _ ActionType) (*FormSchema, error) {
			fs, err := FormSchemaFromModel(configForm{}, ActionEdit, "Save",
				req.BasePath+"/resources/app-config/action?action=edit")
			if err != nil {
				return nil, err
			}
			// Inject a dynamic enum, as the app-config resource does from the
			// live model catalog.
			if p, ok := fs.Schema.Properties.Get("default_host_model"); ok {
				p.Enum = []any{"gpt-4o", "claude-sonnet-5"}
			}
			return fs, nil
		},
		Fetch: func(_ context.Context, _ Request, _ ActionType, _ map[string]any) (*ActionResponse, error) {
			return Detail(map[string]any{"default_host_model": "gpt-4o"}), nil
		},
		Act: func(_ context.Context, _ Request, _ ActionType, data map[string]any) (*ActionResponse, error) {
			acted = data
			return Detail(data), nil
		},
	})

	ctx := context.Background()
	req := Request{BasePath: "/admin"}

	info := res.Info(ctx, req)
	if info.Type != ResourceForm {
		t.Fatalf("Info.Type = %q, want %q", info.Type, ResourceForm)
	}

	// The frontend requests the schema for the "view" action.
	raw, err := res.Schema(ctx, req, ActionView)
	if err != nil {
		t.Fatalf("Schema: %v", err)
	}
	fs, ok := raw.(*FormSchema)
	if !ok {
		t.Fatalf("Schema returned %T, want *FormSchema", raw)
	}
	if fs.Type != ActionEdit {
		t.Errorf("FormSchema.Type = %q, want %q (so the UI prefills+submits)", fs.Type, ActionEdit)
	}
	p, ok := fs.Schema.Properties.Get("default_host_model")
	if !ok || len(p.Enum) != 2 {
		t.Errorf("expected injected enum of len 2, got %#v", p)
	}

	// Prefill.
	got, err := res.Fetch(ctx, req, ActionEdit, nil)
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if m, _ := got.Data.(map[string]any); m["default_host_model"] != "gpt-4o" {
		t.Errorf("Fetch data = %#v", got.Data)
	}

	// Submit.
	if _, err := res.Act(ctx, req, ActionEdit, map[string]any{"default_host_model": "claude-sonnet-5"}); err != nil {
		t.Fatalf("Act: %v", err)
	}
	if acted["default_host_model"] != "claude-sonnet-5" {
		t.Errorf("Act received %#v", acted)
	}
}

func TestNewFormResourceAuthorize(t *testing.T) {
	res := NewFormResource(FormResourceConfig{
		ID: "secret",
		Authorize: func(_ context.Context, _ Identity, _ ActionType) error {
			return ErrForbidden
		},
		Schema: func(_ context.Context, _ Request, _ ActionType) (*FormSchema, error) {
			return &FormSchema{UIType: "form", Type: ActionEdit}, nil
		},
		Act: func(_ context.Context, _ Request, _ ActionType, _ map[string]any) (*ActionResponse, error) {
			return Detail(nil), nil
		},
	})
	if _, err := res.Schema(context.Background(), Request{}, ActionView); err != ErrForbidden {
		t.Errorf("Schema authorize = %v, want ErrForbidden", err)
	}
	if _, err := res.Act(context.Background(), Request{}, ActionEdit, nil); err != ErrForbidden {
		t.Errorf("Act authorize = %v, want ErrForbidden", err)
	}
}
