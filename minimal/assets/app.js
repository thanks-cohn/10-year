(() => {
  const DATA_ROOT = 'data';
  const qs = new URLSearchParams(location.search);

  async function getJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
    return response.json();
  }

  async function loadCoreData() {
    const [fetchData, storageData] = await Promise.all([
      getJson(`${DATA_ROOT}/fetch.json`),
      getJson(`${DATA_ROOT}/storage.json`),
    ]);
    return { fetchData, storageData };
  }

  function sourceBase(storageData, sourceId) {
    const active = storageData.active || 'production';
    const sources = storageData[active]?.sources || storageData.production?.sources || storageData.development?.sources || {};
    const base = sources[sourceId];
    if (!base) throw new Error(`Unknown storage source: ${sourceId}`);
    return base.replace(/\/$/, '');
  }

  function workUrl(work) {
    const chapter = encodeURIComponent(work.chapters?.[0] || '');
    return `reader.html?slug=${encodeURIComponent(work.slug)}${chapter ? `&chapter=${chapter}` : ''}${work.source ? `&source=${encodeURIComponent(work.source)}` : ''}`;
  }

  function chapterLabel(chapter) {
    return String(chapter).replaceAll('_', ' ').replaceAll('/', ' / ');
  }

  function chapterManifestUrl(base, slug, chapter) {
    return `${base}/${encodeURIComponent(slug)}/${chapter}/item.json`;
  }

  function imageUrl(manifest, base, slug, chapter, pageNumber) {
    const resolvedBase = manifest.base_url || `${base}/${encodeURIComponent(slug)}/${chapter}`;
    const padding = Number(manifest.padding || 3);
    const extension = manifest.extension || 'webp';
    return `${resolvedBase.replace(/\/$/, '')}/${String(pageNumber).padStart(padding, '0')}.${extension}`;
  }

  function normalizeManifestChapters(manifest) {
    if (Array.isArray(manifest?.chapters)) return manifest.chapters;
    if (Array.isArray(manifest?.items)) return manifest.items;
    return [];
  }

  function renderWorkCard(work, template) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.href = workUrl(work);
    node.querySelector('.work-title').textContent = work.display || work.slug;
    node.querySelector('.work-meta').textContent = `${work.chapters?.length || 0} chapters`;
    return node;
  }

  function updateCarousel(track, direction) {
    const cards = [...track.querySelectorAll('.work-card')];
    if (!cards.length) return;
    const current = Math.max(0, cards.findIndex((card) => card.classList.contains('is-active')));
    cards[current]?.classList.remove('is-active');
    const next = (current + direction + cards.length) % cards.length;
    cards[next].classList.add('is-active');
    cards[next].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  async function startHome() {
    const { fetchData } = await loadCoreData();
    const works = fetchData.works || [];
    const template = document.getElementById('work-card-template');
    const grid = document.getElementById('works-grid');
    const track = document.getElementById('carousel-track');
    const search = document.getElementById('search-input');

    function render(list) {
      grid.replaceChildren(...list.map((work) => renderWorkCard(work, template)));
      track.replaceChildren(...list.slice(0, 12).map((work, index) => {
        const card = renderWorkCard(work, template);
        card.classList.add('carousel-card');
        if (index === 0) card.classList.add('is-active');
        return card;
      }));
    }

    render(works);
    search?.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      render(query ? works.filter((work) => `${work.display} ${work.slug}`.toLowerCase().includes(query)) : works);
    });
    document.getElementById('carousel-prev')?.addEventListener('click', () => updateCarousel(track, -1));
    document.getElementById('carousel-next')?.addEventListener('click', () => updateCarousel(track, 1));
  }

  async function startReader() {
    const root = document.getElementById('reader-root');
    const select = document.getElementById('chapter-select');
    const { fetchData, storageData } = await loadCoreData();
    const slug = qs.get('slug') || qs.get('work');
    const work = (fetchData.works || []).find((item) => item.slug === slug);
    if (!slug || !work) throw new Error(`Unknown work: ${slug || '(missing)'}`);

    const source = qs.get('source') || work.source || 'e';
    const base = sourceBase(storageData, source);
    let chapters = [...(work.chapters || [])];

    if (!chapters.length) {
      const workManifest = await getJson(`${base}/${encodeURIComponent(slug)}/item.json`);
      chapters = normalizeManifestChapters(workManifest).map((chapter) => typeof chapter === 'string' ? chapter : chapter.path || chapter.slug).filter(Boolean);
    }

    const selectedChapter = qs.get('chapter') || chapters[0];
    if (!selectedChapter) throw new Error(`No chapters available for ${slug}`);

    select.replaceChildren(...chapters.map((chapter) => {
      const option = document.createElement('option');
      option.value = chapter;
      option.textContent = chapterLabel(chapter);
      option.selected = chapter === selectedChapter;
      return option;
    }));

    function go(chapter) {
      location.href = `reader.html?slug=${encodeURIComponent(slug)}&chapter=${encodeURIComponent(chapter)}&source=${encodeURIComponent(source)}`;
    }

    select.addEventListener('change', () => go(select.value));
    const index = chapters.indexOf(selectedChapter);
    document.getElementById('prev-chapter').disabled = index <= 0;
    document.getElementById('next-chapter').disabled = index < 0 || index >= chapters.length - 1;
    document.getElementById('prev-chapter').addEventListener('click', () => index > 0 && go(chapters[index - 1]));
    document.getElementById('next-chapter').addEventListener('click', () => index < chapters.length - 1 && go(chapters[index + 1]));

    const manifest = await getJson(chapterManifestUrl(base, slug, selectedChapter));
    const pages = Number(manifest.pages || manifest.page_count || 0);
    document.title = `${work.display || slug} — ${chapterLabel(selectedChapter)}`;
    root.replaceChildren();

    const title = document.createElement('h1');
    title.className = 'reader-title';
    title.textContent = `${work.display || slug} · ${chapterLabel(selectedChapter)}`;
    root.appendChild(title);

    for (let page = 1; page <= pages; page += 1) {
      const img = document.createElement('img');
      img.className = 'reader-page';
      img.loading = page <= 2 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.alt = `${work.display || slug} ${chapterLabel(selectedChapter)} page ${page}`;
      img.src = imageUrl(manifest, base, slug, selectedChapter, page);
      root.appendChild(img);

      if (page % 8 === 0 && page < pages) {
        const ad = document.createElement('div');
        ad.className = 'ad-slot reader-ad';
        ad.textContent = 'Ad / block placeholder';
        root.appendChild(ad);
      }
    }
  }

  const boot = document.body.dataset.page === 'reader' ? startReader : startHome;
  boot().catch((error) => {
    console.error(error);
    const target = document.getElementById('reader-root') || document.querySelector('main');
    if (target) target.innerHTML = `<div class="error"><h1>AnimePlex minimal failed to load</h1><p>${error.message}</p></div>`;
  });
})();
