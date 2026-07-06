package models

// CreateAuthorInput / UpdateAuthorInput are the form DTOs for the Author
// resource. Keeping them separate from the model lets the form omit read-only
// fields (ID, CreatedAt) and attach widget hints via `uischema:` tags.
type CreateAuthorInput struct {
	Name      string `json:"name" jsonschema:"title=Name,required" validate:"required"`
	Email     string `json:"email" jsonschema:"title=Email,format=email,required" validate:"required,email"`
	AvatarURL string `json:"avatarUrl,omitempty" jsonschema:"title=Avatar URL"`
	Bio       string `json:"bio,omitempty" jsonschema:"title=Bio" uischema:"widget=textarea;ui:options:rows=4"`
}

type UpdateAuthorInput struct {
	Name      string `json:"name" jsonschema:"title=Name,required" validate:"required"`
	Email     string `json:"email" jsonschema:"title=Email,format=email,required" validate:"required,email"`
	AvatarURL string `json:"avatarUrl,omitempty" jsonschema:"title=Avatar URL"`
	Bio       string `json:"bio,omitempty" jsonschema:"title=Bio" uischema:"widget=textarea;ui:options:rows=4"`
}

// CreatePostInput / UpdatePostInput drive the Post form. AuthorID uses the
// ForeignKey widget, which the frontend renders as a search-select backed by
// the "authors" resource's search action.
type CreatePostInput struct {
	Title    string `json:"title" jsonschema:"title=Title,required" validate:"required"`
	Status   string `json:"status" jsonschema:"title=Status,enum=draft,enum=published,enum=archived,default=draft" validate:"required,oneof=draft published archived"`
	AuthorID uint   `json:"authorId" jsonschema:"title=Author,required" validate:"required" uischema:"widget=ForeignKey;ui:options:resource=authors;ui:options:placeholder=Search authors"`
	Color    string `json:"color,omitempty" jsonschema:"title=Label Color" uischema:"widget=color"`
}

type UpdatePostInput struct {
	Title    string `json:"title" jsonschema:"title=Title,required" validate:"required"`
	Status   string `json:"status" jsonschema:"title=Status,enum=draft,enum=published,enum=archived" validate:"required,oneof=draft published archived"`
	AuthorID uint   `json:"authorId" jsonschema:"title=Author,required" validate:"required" uischema:"widget=ForeignKey;ui:options:resource=authors;ui:options:placeholder=Search authors"`
	Color    string `json:"color,omitempty" jsonschema:"title=Label Color" uischema:"widget=color"`
}
