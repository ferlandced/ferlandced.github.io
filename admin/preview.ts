// Preview uses the site's real stylesheet (served under the /ced/ base path).
CMS.registerPreviewStyle("/ced/css/tokens.css");
CMS.registerPreviewStyle("/ced/css/site.css");

const textOf = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

const isFilled = (value: unknown) => value !== undefined && value !== null && value !== "";

const isList = (value: unknown): value is DecapList =>
  typeof value === "object" && value !== null && "map" in value && "size" in value;

const isMap = (value: unknown): value is DecapMap =>
  typeof value === "object" && value !== null && "get" in value;

const ListingPreview = createClass({
  render() {
    const { entry, getAsset } = this.props;
    const get = (key: string) => entry.getIn(["data", key]);
    const price = get("price");
    const photos = get("photos");
    const facts = [
      isFilled(get("bedrooms")) ? `${textOf(get("bedrooms"))} bd` : null,
      isFilled(get("bathrooms")) ? `${textOf(get("bathrooms"))} ba` : null,
      get("area") ? `${textOf(get("area"))} sq ft` : null,
      textOf(get("neighbourhood")) || null,
    ].filter(Boolean);

    return h(
      "main",
      { className: "container" },
      h(
        "article",
        { className: "listing" },
        get("status") ? h("span", { className: "listing__status" }, textOf(get("status"))) : null,
        h("h1", {}, textOf(get("title")) || "Untitled listing"),
        h("p", { className: "listing__address" }, textOf(get("address"))),
        isFilled(price)
          ? h("p", { className: "listing__price" }, `$${Number(price).toLocaleString()}`)
          : null,
        h(
          "ul",
          { className: "listing__facts" },
          facts.map((fact, index) => h("li", { key: index }, fact)),
        ),
        h("div", {}, this.props.widgetFor("body")),
        isList(photos) && photos.size
          ? h(
              "div",
              { className: "listing__photos" },
              photos
                .map((photo, index) => {
                  const source = textOf(isMap(photo) ? photo.get("image") : photo);
                  return source
                    ? h("img", { key: index, src: getAsset(source).toString(), alt: "" })
                    : null;
                })
                .toArray(),
            )
          : null,
      ),
    );
  },
});

CMS.registerPreviewTemplate("listings", ListingPreview);
