package admin_test

import (
	"encoding/json"
	"testing"

	"github.com/rxtech-lab/admin-generator/admin"
)

func TestCustomResourcePageSchema(t *testing.T) {
	res := admin.NewCustomResourcePage(admin.CustomResourceConfig{
		ID:   "dashboard",
		Name: "Dashboard",
		Icon: "layout-dashboard",
		Page: admin.CustomResourcePage{
			ActionButtons: []admin.ActionButton{{
				Type:       admin.ButtonPrimary,
				Label:      "Export",
				Icon:       "download",
				Behavior:   admin.BehaviorSubmit,
				ActionType: admin.ActionExport,
			}},
			Sections: []admin.CustomPageSection{
				{
					Type:  admin.CustomPageSectionStatistics,
					Title: "Overview",
					Statistics: []admin.Statistic{{
						Label: "Posts",
						Value: 42,
					}},
				},
				{
					Type:  admin.CustomPageSectionCharts,
					Title: "Traffic",
					Children: []admin.Chart{{
						Type: admin.ChartTypeBar,
						Data: []map[string]any{{"day": "Mon", "views": 10}},
						XKey: "day",
						YKey: "views",
					}},
				},
				{
					Type: admin.CustomPageSectionText,
					Body: "Operational notes",
				},
			},
		},
	})

	info := res.Info(t.Context(), admin.Request{BasePath: "/admin"})
	if info.Type != admin.ResourceCustom {
		t.Fatalf("want custom resource type, got %q", info.Type)
	}
	if len(info.SupportedActions) != 1 {
		t.Fatalf("want 1 supported action, got %d", len(info.SupportedActions))
	}
	if info.SupportedActions[0].OnClick != "/admin/resources/dashboard/action?action=export" {
		t.Fatalf("unexpected action URL: %q", info.SupportedActions[0].OnClick)
	}

	raw, err := res.Schema(t.Context(), admin.Request{BasePath: "/admin"}, admin.ActionView)
	if err != nil {
		t.Fatalf("schema: %v", err)
	}
	page := raw.(*admin.CustomResourcePage)
	if page.UIType != "custom" {
		t.Fatalf("want custom uiType, got %q", page.UIType)
	}
	if len(page.Sections) != 3 {
		t.Fatalf("want 3 sections, got %d", len(page.Sections))
	}

	encoded, err := json.Marshal(page)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var decoded struct {
		UIType   string `json:"uiType"`
		Sections []struct {
			Type string `json:"type"`
		} `json:"sections"`
	}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded.UIType != "custom" || decoded.Sections[0].Type != "statistics" {
		t.Fatalf("unexpected json: %s", encoded)
	}
}
