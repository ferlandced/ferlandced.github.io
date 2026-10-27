/* global CMS, h, createClass */
// Preview uses the site's real stylesheet (served under the /ced/ base path).
CMS.registerPreviewStyle('/ced/css/tokens.css');
CMS.registerPreviewStyle('/ced/css/site.css');

var ListingPreview = createClass({
  render: function () {
    var entry = this.props.entry;
    var get = function (k) { return entry.getIn(['data', k]); };
    var getAsset = this.props.getAsset;
    var price = get('price');
    var photos = get('photos');
    var facts = [
      get('bedrooms') != null && get('bedrooms') !== '' ? get('bedrooms') + ' bd' : null,
      get('bathrooms') != null && get('bathrooms') !== '' ? get('bathrooms') + ' ba' : null,
      get('area') ? get('area') + ' sq ft' : null,
      get('neighbourhood') || null
    ].filter(Boolean);

    return h('main', { className: 'container' },
      h('article', { className: 'listing' },
        get('status') ? h('span', { className: 'listing__status' }, get('status')) : null,
        h('h1', {}, get('title') || 'Untitled listing'),
        h('p', { className: 'listing__address' }, get('address') || ''),
        price != null && price !== '' ? h('p', { className: 'listing__price' }, '$' + Number(price).toLocaleString()) : null,
        h('ul', { className: 'listing__facts' }, facts.map(function (f, i) { return h('li', { key: i }, f); })),
        h('div', {}, this.props.widgetFor('body')),
        photos && photos.size ? h('div', { className: 'listing__photos' },
          photos.map(function (p, i) {
            var src = p && p.get ? p.get('image') : p;
            return src ? h('img', { key: i, src: getAsset(src).toString(), alt: '' }) : null;
          }).toArray()
        ) : null
      )
    );
  }
});

CMS.registerPreviewTemplate('listings', ListingPreview);
