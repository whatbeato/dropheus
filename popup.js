document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('check-btn');
  const resultsEl = document.getElementById('results');

  btn.addEventListener('click', async () => {
    clearResults();
    setStatus('trying to find the product title...');

    try {
      const title = await getTitleFromActiveTab();
      if (!title) {
        setStatus('could not find the title... are you on etsy, amazon or ebay?');
        return;
      }

      setStatus('Querying dropship API...');
      const apiHost = 'https://j4cswgw8gwk8wcs4o4ww0oks.fonz.pt';
      const apiUrl = `${apiHost}/search/?q=${encodeURIComponent(title)}`;

      const resp = await fetch(apiUrl, { headers: { Accept: 'application/json, text/plain, */*' } });
      if (!resp.ok) {
        const maybeText = await resp.text().catch(() => null);
        throw new Error(`API returned ${resp.status} from ${apiHost}${maybeText ? `: ${maybeText}` : ''}`);
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      let data;
      if (contentType.includes('application/json')) {
        try {
          data = await resp.json();
        } catch (e) {
          const raw = await resp.text().catch(() => null);
          setStatus(raw ? `api returned invalid json: ${raw}` : `api returned invalid json: ${e.message}`);
          return;
        }
      } else {
        const text = await resp.text().catch(() => null);
        setStatus(text || 'api returned non-json response');
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        setStatus('no results found');
        return;
      }

      setStatus('Results:');
      renderResults(data);
    } catch (err) {
      console.error(err);
      setStatus('error: ' + (err.message || err));
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

          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              func: () => {
                try {
                  const host = (location && location.hostname) ? location.hostname.toLowerCase() : '';

                  if (host.includes('amazon.')) {
                    const amazonSel = document.getElementById('productTitle') || document.querySelector('#title span#productTitle') || document.getElementById('ebooksProductTitle') || document.querySelector('#title');
                    if (amazonSel) {
                      const txt = (amazonSel.innerText || amazonSel.textContent || '').trim();
                      if (txt) return txt;
                    }
                  }

                  if (host.includes('ebay.')) {
                    const ebaySel = document.querySelector('#itemTitle') || document.querySelector('h1[itemprop="name"]') || document.querySelector('.it-ttl') || document.querySelector('h1');
                    if (ebaySel) {
                      let txt = (ebaySel.innerText || ebaySel.textContent || '').trim();
                      txt = txt.replace(/^Details\s+about\s*/i, '').trim();
                      if (txt) return txt;
                    }
                  }

                  const og = document.querySelector('meta[property="og:title"]') || document.querySelector('meta[name="og:title"]');
                  if (og && og.content) return og.content.trim();

                  const h1 = document.querySelector('h1');
                  if (h1 && h1.innerText) return h1.innerText.trim();

                  const titleSelectors = ['[data-test-listing-title]', '.product-title', '.title', '.listing-title', '.wt-text-body-03'];
                  for (const s of titleSelectors) {
                    const el = document.querySelector(s);
                    if (el && (el.innerText || el.textContent)) return (el.innerText || el.textContent).trim();
                  }

                  if (document.title) return document.title.trim();
                } catch (e) {
                }
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
      btn.textContent = 'see on aliexpress';
      btn.addEventListener('click', () => {
        let u = item.url || '';
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
