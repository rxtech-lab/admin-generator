package admin

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

// CustomActionHandler executes a server-owned action from a custom page button.
type CustomActionHandler func(ctx context.Context, req Request, data map[string]any) (*ActionResponse, error)

// CustomResourceConfig configures a custom admin page made of sections such as
// charts, statistics, and text.
type CustomResourceConfig struct {
	ID          string
	Name        string
	Description string
	Icon        string
	Page        CustomResourcePage
	Authorize   func(ctx context.Context, identity Identity, action ActionType) error
	Actions     map[ActionType]CustomActionHandler
}

type customResource struct {
	cfg CustomResourceConfig
}

// NewCustomResourcePage builds a Resource backed by a static custom page
// schema. Action buttons may either navigate with their OnClick URL or post to
// handlers configured in Actions.
func NewCustomResourcePage(cfg CustomResourceConfig) Resource {
	if cfg.ID == "" {
		panic("admin: CustomResourceConfig.ID is required")
	}
	if cfg.Name == "" {
		cfg.Name = humanizeFieldName(strings.ToUpper(cfg.ID[:1]) + cfg.ID[1:])
	}
	return &customResource{cfg: cfg}
}

func (r *customResource) ID() string { return r.cfg.ID }

func (r *customResource) actionURL(req Request, action ActionType) string {
	return req.BasePath + "/resources/" + r.cfg.ID + "/action?action=" + url.QueryEscape(string(action))
}

func (r *customResource) Info(_ context.Context, req Request) ResourceInfo {
	return ResourceInfo{
		ID:               r.cfg.ID,
		Name:             r.cfg.Name,
		Description:      r.cfg.Description,
		Icon:             r.cfg.Icon,
		Type:             ResourceCustom,
		DataURL:          r.actionURL(req, ActionView),
		DefaultAction:    ActionView,
		SupportedActions: r.page(req).ActionButtons,
	}
}

func (r *customResource) authorize(ctx context.Context, req Request, action ActionType) error {
	if r.cfg.Authorize != nil {
		return r.cfg.Authorize(ctx, req.Identity, action)
	}
	return nil
}

func (r *customResource) Schema(ctx context.Context, req Request, action ActionType) (any, error) {
	if action == "" {
		action = ActionView
	}
	if action != ActionView {
		return nil, fmt.Errorf("%w: no schema for action %q", ErrBadInput, action)
	}
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	page := r.page(req)
	return &page, nil
}

func (r *customResource) Fetch(ctx context.Context, req Request, action ActionType, _ map[string]any) (*ActionResponse, error) {
	if action == "" {
		action = ActionView
	}
	if action != ActionView {
		return nil, fmt.Errorf("%w: cannot fetch action %q", ErrBadInput, action)
	}
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	return Detail(map[string]any{}), nil
}

func (r *customResource) Act(ctx context.Context, req Request, action ActionType, data map[string]any) (*ActionResponse, error) {
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	handler, ok := r.cfg.Actions[action]
	if !ok {
		return nil, fmt.Errorf("%w: action %q not supported by resource %q", ErrBadInput, action, r.cfg.ID)
	}
	return handler(ctx, req, data)
}

func (r *customResource) page(req Request) CustomResourcePage {
	page := r.cfg.Page
	page.UIType = "custom"
	page.Type = ActionView
	if page.ActionButtons == nil {
		page.ActionButtons = []ActionButton{}
	} else {
		page.ActionButtons = append([]ActionButton(nil), page.ActionButtons...)
	}
	if page.Sections == nil {
		page.Sections = []CustomPageSection{}
	} else {
		page.Sections = append([]CustomPageSection(nil), page.Sections...)
	}
	for i := range page.ActionButtons {
		if page.ActionButtons[i].OnClick == "" && page.ActionButtons[i].ActionType != "" {
			page.ActionButtons[i].OnClick = r.actionURL(req, page.ActionButtons[i].ActionType)
		}
	}
	return page
}
