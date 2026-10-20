// Renders the agent profile managed in /admin (content/agent.json).
(function () {
  var root = document.getElementById('profile');
  if (!root) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // The bio is a Markdown field. Render plain paragraphs only; text stays escaped.
  function paragraphs(md) {
    var frag = document.createDocumentFragment();
    String(md || '').trim().split(/\n\s*\n/).forEach(function (block) {
      var t = block.replace(/\s*\n\s*/g, ' ').trim();
      if (t) frag.appendChild(el('p', null, t));
    });
    return frag;
  }

  fetch('content/agent.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (a) {
      root.textContent = '';
      if (a.photo) {
        var img = el('img', 'profile__photo');
        img.src = a.photo;
        img.alt = a.name || '';
        root.appendChild(img);
      }
      var body = el('div', 'profile__body');
      body.appendChild(el('h1', 'profile__name', a.name || ''));
      if (a.title) body.appendChild(el('p', 'profile__title', a.title));
      if (a.bio) body.appendChild(paragraphs(a.bio));

      var contact = el('ul', 'profile__contact');
      if (a.phone) {
        var li = el('li'); var link = el('a', null, a.phone);
        link.href = 'tel:' + a.phone.replace(/[^\d+]/g, '');
        li.appendChild(link); contact.appendChild(li);
      }
      if (a.email) {
        var li2 = el('li'); var mail = el('a', null, a.email);
        mail.href = 'mailto:' + a.email;
        li2.appendChild(mail); contact.appendChild(li2);
      }
      if (a.languages && a.languages.length) contact.appendChild(el('li', null, 'Languages: ' + a.languages.join(', ')));
      if (contact.children.length) body.appendChild(contact);

      root.appendChild(body);
    })
    .catch(function () {
      root.textContent = '';
      root.appendChild(el('p', null, 'Profile unavailable.'));
    });
})();
