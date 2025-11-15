document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('check-btn');
  const resultsEl = document.getElementById('results');

  btn.addEventListener('click', async () => {
    clearResults();
    setStatus('trying to find the product title...');

    try {
      const title = await getTitleFromActiveTab();
      if (!title) {
        setStatus('could not find the title... are you on etsy?');
        return;
      }

  setStatus('Querying dropship API...');
  // Use the provided fonz.pt API host
  const apiHost = 'https://j4cswgw8gwk8wcs4o4ww0oks.fonz.pt';
  const apiUrl = `${apiHost}/search/?q=${encodeURIComponent(title)}`;

      // Ask for JSON but accept plain text too. Some dev endpoints return simple text.
      const resp = await fetch(apiUrl, { headers: { Accept: 'application/json, text/plain, */*' } });
      if (!resp.ok) {
        // Try to show any returned text for easier debugging
        const maybeText = await resp.text().catch(() => null);
        throw new Error(`API returned ${resp.status} from ${apiHost}${maybeText ? `: ${maybeText}` : ''}`);
      }

      // If server does not return JSON (e.g. "API is running!"), show the raw text instead of failing
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      let data;
      if (contentType.includes('application/json')) {
        try {
          data = await resp.json();
        } catch (e) {
          const raw = await resp.text().catch(() => null);
          setStatus(raw ? `API returned invalid JSON: ${raw}` : `API returned invalid JSON: ${e.message}`);
          return;
        }
      } else {
        // Non-JSON response: display the text directly (useful for dev endpoints)
        const text = await resp.text().catch(() => null);
        setStatus(text || 'API returned non-JSON response');
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        setStatus('No results found.');
        return;
      }

      setStatus('Results:');
      renderResults(data);
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + (err.message || err));
    }
  });

  function clearResults() {
    resultsEl.innerHTML = '';
  }

  function setStatus(text) {
    clearResults();
    const p = document.createElement('p');
    p.textContent = text;
    resultsEl.appendChild(p);
  }

  async function getTitleFromActiveTab() {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || tabs.length === 0) return resolve('');
          const tab = tabs[0];

          // Execute a small script in the page to extract a likely product title.
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              func: () => {
                // Prefer og:title meta, then h1, then document.title
                const og = document.querySelector('meta[property="og:title"]') || document.querySelector('meta[name="og:title"]');
                if (og && og.content) return og.content.trim();

                const h1 = document.querySelector('h1');
                if (h1 && h1.innerText) return h1.innerText.trim();

                if (document.title) return document.title.trim();

                return '';
              }
            },
            (injectionResults) => {
              try {
                if (chrome.runtime.lastError) {
                  console.warn('scripting error', chrome.runtime.lastError.message);
                  return resolve('');
                }
                const r = injectionResults && injectionResults[0] && injectionResults[0].result;
                resolve(r || '');
              } catch (e) {
                resolve('');
              }
            }
          );
        });
      } catch (e) {
        resolve('');
      }
    });
  }

  function renderResults(items) {
    clearResults();

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';

      const img = document.createElement('img');
      // Image URLs may start with //
      let src = item.image || '';
      if (src.startsWith('//')) src = 'https:' + src;
      if (!src.startsWith('http')) src = 'https:' + src;
      img.src = src;
      img.alt = item.title || '';
      img.className = 'thumb';

      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = item.title || '';

      const btn = document.createElement('button');
      btn.textContent = 'Open on AliExpress';
      btn.addEventListener('click', () => {
        let u = item.url || '';
        // urls may be protocol-relative
        if (u.startsWith('//')) u = 'https:' + u;
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
        chrome.tabs.create({ url: u });
      });

      const price = document.createElement('div');
      price.className = 'price';
      if (typeof item.price !== 'undefined') price.textContent = `$${item.price}`;

      card.appendChild(img);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.appendChild(title);
      meta.appendChild(price);
      meta.appendChild(btn);
      card.appendChild(meta);

      resultsEl.appendChild(card);
    });
  }
});
