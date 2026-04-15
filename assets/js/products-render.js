/* Asian3DFrames dynamic product rendering logic */
(() => {
  'use strict';

  const API_URL = 'php/get_products.php';
  const CATEGORIES_URL = 'php/get_categories.php';
  const RECENT_SEEN_KEY = 'g4y_recent_seen';

  let cachedCategories = [];

  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

  const escapeHtml = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatEgp = (v) => `${Number(v || 0).toFixed(0)}`;

  const readRecentSeen = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_SEEN_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (_err) {
      return [];
    }
  };

  const writeRecentSeen = (items) => {
    localStorage.setItem(RECENT_SEEN_KEY, JSON.stringify(items.slice(0, 12)));
  };

  const trackRecentProduct = (product, imageUrl) => {
    const id = Number(product?.id || 0);
    if (!id) return;

    const next = {
      type: 'product',
      id,
      title: String(product?.name || 'Product'),
      subtitle: String(productCategoryName(product) || ''),
      image: String(imageUrl || product?.image || ''),
      url: `product.html?id=${encodeURIComponent(id)}`,
      is_best_seller: Boolean(product?.is_best_seller),
      seen_at: Date.now(),
    };
    if (!next.image) return;

    const list = readRecentSeen().filter((item) => !(String(item?.type) === 'product' && Number(item?.id || 0) === id));
    list.unshift(next);
    writeRecentSeen(list);
    window.dispatchEvent(new Event('g4y-recent-updated'));
  };

  const normalizeImages = (product) => {
    if (Array.isArray(product?.images) && product.images.length) {
      return product.images.map((item) => String(item || '').trim()).filter(Boolean);
    }

    const fallback = String(product?.image || '').trim();
    return fallback ? [fallback] : [];
  };

  const categoryLabel = (cat) => {
    const value = String(cat || '').trim();
    if (!value) return 'Category';
    return value
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  };

  const productCategoryId = (p) => {
    const id = Number(p?.category_id || 0);
    return Number.isFinite(id) ? id : 0;
  };

  const productCategoryName = (p) => {
    const name = String(p?.category_name || '').trim();
    if (name) return name;
    const legacy = String(p?.category || '').trim();
    const legacyLc = legacy.toLowerCase();
    if (legacyLc === 'mobile') return 'Mobile Photo Frame';
    if (legacyLc === 'normal') return 'Normal Photo Frame';
    return legacy;
  };

  async function fetchCategories() {
    try {
      const res = await fetch(CATEGORIES_URL, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.success || !Array.isArray(data.categories)) return [];
      return data.categories;
    } catch (_err) {
      return [];
    }
  }

  function renderCategoryStrip(categories) {
    const row = qs('#publicCategoryRow');
    if (!row) return;
    if (!Array.isArray(categories) || !categories.length) return;

    row.innerHTML = categories.map((c) => {
      const id = Number(c.id || 0);
      const name = escapeHtml(String(c.name || '').trim() || 'Category');
      const img = escapeHtml(String(c.image || '').trim() || 'https://placehold.co/280x280/f5e6d3/c8956c?text=Category');
      const href = `products.html?category_id=${encodeURIComponent(id)}`;
      return `
        <a href="${href}" class="cat-circle-card">
          <div class="cat-circle-img">
            <img src="${img}" alt="${name}" onerror="this.src='https://placehold.co/280x280/f5e6d3/c8956c?text=Category'" />
          </div>
          <span class="cat-circle-name">${name}</span>
        </a>
      `;
    }).join('');
  }

  function renderFooterShopLinks(categories) {
    const list = qs('#footerShopLinks');
    if (!list) return;
    if (!Array.isArray(categories) || !categories.length) return;
    list.innerHTML = categories.map((c) => {
      const id = Number(c.id || 0);
      const name = escapeHtml(String(c.name || '').trim() || 'Category');
      const href = `products.html?category_id=${encodeURIComponent(id)}`;
      return `<li><a href="${href}">${name}</a></li>`;
    }).join('');
  }

  function notify(msg, type = 'success') {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type);
      return;
    }
    alert(msg);
  }

  function ensureAddToCart() {
    if (typeof window.addToCart === 'function') return;
    window.addToCart = (id, name, price, image, quantity = 1, selectedOptions = null) => {
      const opts = selectedOptions || { frame_type: 'normal', frame_size: 'A4', frame_color: 'white' };
      const frameType = String(opts.frame_type || 'normal').toLowerCase() === 'mobile' ? 'mobile' : 'normal';
      const allowedSizes = [
        'A1', 'A2', 'A3', 'A4', '2 FEET X 4 FEET', // mobile and normal
        '4 FEET X 4 FEET', '4 FEET X 6 FEET', '4 FEET X 8 FEET', 'CUSTOMISED SIZE' // normal only
      ];
      const frameSize = allowedSizes.includes(String(opts.frame_size || '').toUpperCase())
        ? String(opts.frame_size).toUpperCase()
        : 'A4';
      const frameColor = frameType === 'mobile'
        ? (String(opts.frame_color || '').toLowerCase() === 'black' ? 'black' : 'gray')
        : (String(opts.frame_color || '').toLowerCase() === 'black' ? 'black' : 'white');
      const qty = Math.max(1, Math.min(99, Number(quantity) || 1));

      const raw = localStorage.getItem('cart');
      const cart = raw ? JSON.parse(raw) : [];
      const lineKey = `${Number(id)}::${frameType}::${frameSize}::${frameColor}`;
      const exists = cart.find((i) => String(i.line_key || '') === lineKey);
      if (exists) exists.quantity = Math.min(99, Number(exists.quantity || 1) + qty);
      else cart.push({ id: Number(id), name, price: Number(price), image, quantity: qty, frame_type: frameType, frame_size: frameSize, frame_color: frameColor, line_key: lineKey });
      localStorage.setItem('cart', JSON.stringify(cart));

      fetch('php/add_to_cart.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: Number(id), quantity: qty, frame_type: frameType, frame_size: frameSize, frame_color: frameColor })
      }).catch(() => {});

      notify('Item added to cart');
    };
  }

  async function fetchProducts() {
    const res = await fetch(API_URL, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Failed to load products');
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to load products');
    return data.products || [];
  }

  async function fetchOneProduct(id) {
    const res = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Product not found');
    const data = await res.json();
    if (!data.success || !data.product) throw new Error(data.message || 'Product not found');
    return data.product;
  }

  function productCardTemplate(p) {
    const img = escapeHtml(p.image || 'assets/images/products/placeholder.jpg');
    const name = escapeHtml(p.name);
    const old = p.old_price ? `<span class="product-old-price">${formatEgp(p.old_price)}</span>` : '';
    const productUrl = `product.html?id=${encodeURIComponent(p.id)}`;
    const isBestSeller = Boolean(p?.is_best_seller);

    return `
      <a href="${productUrl}" class="product-card-link">
        <article class="product-card" data-product-id="${p.id}">
          <div class="product-img-wrap">
            ${isBestSeller ? '<span class="product-badge bestseller">Best Seller</span>' : ''}
            <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='https://placehold.co/420x560/f8f8f8/b7b7b7?text=Asian3DFrames';" />
          </div>
          <div class="product-info">
            <div class="product-footer">
              <div class="product-price-row">
                ${Number(p.price) > 0 ? `<span class="product-price">${formatEgp(p.price)}</span>` : ''}
                ${old}
              </div>
              <div class="product-actions">
                ${Number(p.price) > 0 ? `<button class="add-to-cart-btn" type="button" data-product='${escapeHtml(JSON.stringify({ id: p.id, name: p.name, price: p.price, image: p.image }))}'>
                  <i class="fas fa-cart-plus"></i>
                </button>` : ''}
              </div>
            </div>
          </div>
        </article>
      </a>
    `;
  }

  function mountProductsPage(products) {
    const grid = qs('#shopGrid');
    const noRes = qs('#noResults');
    const resultCount = qs('#resultCount');
    const sortSelect = qs('#sortSelect');
    const priceMin = qs('#priceMin');
    const priceMax = qs('#priceMax');

    if (!grid) return;

    const categoryValues = Array.from(
      new Map(
        products.map((p) => {
          const id = productCategoryId(p);
          const name = productCategoryName(p);
          const key = id > 0 ? String(id) : `legacy:${String(name || '').toLowerCase()}`;
          return [key, { id, name }];
        })
      ).values()
    );
    const catContainer = qs('#categoryFilters');
    if (catContainer) {
      const list = Array.isArray(cachedCategories) && cachedCategories.length
        ? cachedCategories.map((c) => ({ id: Number(c.id || 0), name: String(c.name || '').trim() }))
        : categoryValues;
      catContainer.innerHTML = list.map((cat) => {
        const value = cat.id ? String(cat.id) : `legacy:${String(cat.name || '').toLowerCase()}`;
        const label = cat.name ? String(cat.name) : categoryLabel(value);
        return `
          <label class="filter-option">
            <input type="checkbox" class="cat-filter" value="${escapeHtml(value)}" />
            <span>${escapeHtml(label)}</span>
          </label>
        `;
      }).join('');
    }

    const params = new URLSearchParams(location.search);
    const urlCatRaw = params.get('category_id') || params.get('category');
    if (urlCatRaw) {
      const wanted = String(urlCatRaw).trim();
      const wantedValue = /^\d+$/.test(wanted) ? wanted : `legacy:${wanted.toLowerCase()}`;
      const cb = qsa('.cat-filter').find((el) => el.value === wantedValue);
      if (cb) cb.checked = true;
    }

    const applyFilters = () => {
      const selectedCats = qsa('.cat-filter:checked').map((i) => i.value);
      const forcedUrlCat = String(new URLSearchParams(location.search).get('category_id') || new URLSearchParams(location.search).get('category') || '').trim();
      const forcedValue = forcedUrlCat ? (/^\d+$/.test(forcedUrlCat) ? forcedUrlCat : `legacy:${forcedUrlCat.toLowerCase()}`) : '';
      const effectiveCats = selectedCats.length ? selectedCats : (forcedValue ? [forcedValue] : []);
      const min = Number(priceMin?.value || 0) || 0;
      const max = Number(priceMax?.value || Number.POSITIVE_INFINITY) || Number.POSITIVE_INFINITY;
      const sort = sortSelect?.value || 'newest';

      let list = products.filter((p) => {
        if (effectiveCats.length) {
          const pid = productCategoryId(p);
          const legacy = `legacy:${String(productCategoryName(p) || '').toLowerCase()}`;
          const ok = effectiveCats.some((v) => {
            if (/^\d+$/.test(v)) return pid > 0 && String(pid) === v;
            return v === legacy;
          });
          if (!ok) return false;
        }
        if (Number(p.price) < min || Number(p.price) > max) return false;
        return true;
      });

      if (sort === 'price-asc') list = list.sort((a, b) => Number(a.price) - Number(b.price));
      if (sort === 'price-desc') list = list.sort((a, b) => Number(b.price) - Number(a.price));
      if (sort === 'name-asc') list = list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (sort === 'newest') list = list.sort((a, b) => Number(b.id) - Number(a.id));

      resultCount.textContent = String(list.length);
      if (!list.length) {
        grid.innerHTML = '';
        if (noRes) noRes.style.display = 'block';
        return;
      }

      if (noRes) noRes.style.display = 'none';
      grid.innerHTML = list.map(productCardTemplate).join('');
    };

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches('.cat-filter, #sortSelect, #priceMin, #priceMax')) applyFilters();
    });

    qsa('#priceMin, #priceMax').forEach((el) => {
      el.addEventListener('input', applyFilters);
    });

    const clearBtn = qs('#clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        qsa('.cat-filter').forEach((c) => { c.checked = false; });
        if (priceMin) priceMin.value = '';
        if (priceMax) priceMax.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        applyFilters();
      });
    }

    grid.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-product]') : null;
      if (btn) {
        e.preventDefault(); // Prevent navigation when clicking the cart button
        const payload = JSON.parse(btn.getAttribute('data-product'));
        window.addToCart(payload.id, payload.name, payload.price, payload.image);
        return;
      }
    });

    // No longer need keydown listener for navigation, as the link handles it.
    // The 'add-to-cart-btn' is a button and will be handled by keyboard automatically.


    applyFilters();
  }

  function mountProductDetail(product, options = {}) {
    const name = qs('#pName');
    const category = qs('#pCategory');
    const bestSellerBadge = qs('#pBestSellerBadge');
    const price = qs('#pPrice');
    const oldPrice = qs('#pOldPrice');
    const image = qs('#pImage');
    const thumbs = qs('#pImageThumbs');
    const desc = qs('#pDesc');
    const qtyInput = qs('#qtyInput');
    const addBtn = qs('#addToCartBtn');
    const buyBtn = qs('#buyNowBtn');

    if (!name || !price || !image || !desc) return;

    // Only declare params/customMode once at the top
    let customMode = false;
    try {
      const params = new URLSearchParams(location.search);
      customMode = params.get('custom') === '1';
    } catch (e) {}
    name.textContent = customMode ? 'Custom Image' : product.name;
    if (category) category.textContent = customMode ? 'Custom Image' : (productCategoryName(product) || 'Category');
    
    // Fetch dynamic frame price for global pricing (category_id=0)
    const displayPrice = async () => {
      let displayedPrice = product.price;
      if (typeof window.g4yGetSelectedFrameOptions === 'function') {
        try {
          const opts = window.g4yGetSelectedFrameOptions();
          if (opts.frame_type && opts.frame_size) {
            const priceRes = await fetch(`php/get_frame_price.php?category_id=0&frame_type=${encodeURIComponent(opts.frame_type)}&size=${encodeURIComponent(opts.frame_size)}`);
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              if (priceData.success && priceData.price) {
                displayedPrice = priceData.price;
              }
            }
          }
        } catch (err) {
          console.warn('Could not fetch dynamic price:', err);
        }
      }
      price.textContent = formatEgp(displayedPrice);
    };
    
    displayPrice();
    
    if (oldPrice) {
      if (product.old_price) {
        oldPrice.textContent = formatEgp(product.old_price);
        oldPrice.style.display = 'inline';
      } else {
        oldPrice.style.display = 'none';
      }
    }
    const imageList = options.overrideImage ? [options.overrideImage] : normalizeImages(product);
    let selectedImage = imageList[0] || product.image;
    image.src = selectedImage || 'https://placehold.co/700x600/f8f8f8/b7b7b7?text=Asian3DFrames';
    image.alt = product.name;
    desc.textContent = product.description || 'No description available.';
    trackRecentProduct(product, selectedImage);

    if (thumbs) {
      if (imageList.length > 1) {
        thumbs.innerHTML = imageList.map((src, index) => `
          <button class="thumb-btn ${index === 0 ? 'is-active' : ''}" type="button" data-image-src="${escapeHtml(src)}" aria-label="View product image ${index + 1}">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} image ${index + 1}" loading="lazy" onerror="this.closest('button').remove();" />
          </button>
        `).join('');
        thumbs.style.display = 'grid';
        thumbs.onclick = (event) => {
          const button = event.target instanceof Element ? event.target.closest('[data-image-src]') : null;
          if (!button) return;
          selectedImage = button.getAttribute('data-image-src') || selectedImage;
          image.src = selectedImage;
          qsa('.thumb-btn', thumbs).forEach((item) => item.classList.toggle('is-active', item === button));
        };
      } else {
        thumbs.innerHTML = '';
        thumbs.style.display = 'none';
      }
    }

    const getQty = () => Math.max(1, Math.min(99, Number(qtyInput?.value || 1) || 1));

    // Add event listeners to update price when frame options change
    const frameTypeButtons = qsa('[data-frame-type]');
    const frameSizeButtons = qsa('[data-frame-size]');
    if (frameTypeButtons.length || frameSizeButtons.length) {
      const updateDisplayedPrice = () => {
        displayPrice();
      };
      frameTypeButtons.forEach(btn => {
        btn.addEventListener('click', updateDisplayedPrice);
      });
      frameSizeButtons.forEach(btn => {
        btn.addEventListener('click', updateDisplayedPrice);
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (typeof window.g4yValidateRequiredFrameOptions === 'function' && !window.g4yValidateRequiredFrameOptions()) {
          return;
        }
        const qty = getQty();
        const options = typeof window.g4yGetSelectedFrameOptions === 'function'
          ? window.g4yGetSelectedFrameOptions()
          : { frame_type: 'normal', frame_size: 'A4', frame_color: 'white' };
        
        // Fetch dynamic price based on frame type and size (global pricing)
        let price = product.price;
        if (options.frame_type && options.frame_size) {
          try {
            const priceRes = await fetch(`php/get_frame_price.php?category_id=0&frame_type=${encodeURIComponent(options.frame_type)}&size=${encodeURIComponent(options.frame_size)}`);
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              if (priceData.success && priceData.price) {
                price = priceData.price;
              }
            }
          } catch (err) {
            console.warn('Could not fetch dynamic price:', err);
          }
        }
        
        window.addToCart(product.id, product.name, price, selectedImage || product.image, qty, options);
      });
    }

    if (buyBtn) {
      buyBtn.addEventListener('click', async () => {
        if (typeof window.g4yValidateRequiredFrameOptions === 'function' && !window.g4yValidateRequiredFrameOptions()) {
          return;
        }
        const qty = getQty();
        const options = typeof window.g4yGetSelectedFrameOptions === 'function'
          ? window.g4yGetSelectedFrameOptions()
          : { frame_type: 'normal', frame_size: 'A4', frame_color: 'white' };
        
        // Fetch dynamic price based on frame type and size (global pricing)
        let price = product.price;
        if (options.frame_type && options.frame_size) {
          try {
            const priceRes = await fetch(`php/get_frame_price.php?category_id=0&frame_type=${encodeURIComponent(options.frame_type)}&size=${encodeURIComponent(options.frame_size)}`);
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              if (priceData.success && priceData.price) {
                price = priceData.price;
              }
            }
          } catch (err) {
            console.warn('Could not fetch dynamic price:', err);
          }
        }
        
        window.addToCart(product.id, product.name, price, selectedImage || product.image, qty, options);
        location.href = 'cart.html';
      });
    }
  }

  function mountDetailFeatured(currentProductId, products) {
    const section = qs('#detailFeaturedSection');
    const grid = qs('#detailFeaturedGrid');
    if (!section || !grid) return;

    const list = Array.isArray(products) ? products : [];
    const currentId = Number(currentProductId || 0);
    const filtered = list.filter((p) => Number(p?.id || 0) !== currentId);

    // Sort by best_seller DESC to prioritize best sellers but still show featured products
    // Shuffle filtered products and pick 4 random
    const shuffled = filtered.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const featured = shuffled.slice(0, 4);

    if (!featured.length) {
      section.hidden = true;
      grid.innerHTML = '';
      return;
    }

    section.hidden = false;
    grid.innerHTML = featured.map((p) => {
      const id = Number(p?.id || 0);
      const img = escapeHtml(String(p?.image || 'https://placehold.co/420x560/f8f8f8/b7b7b7?text=Asian3DFrames'));
      const name = escapeHtml(String(p?.name || 'Product'));
      const old = p?.old_price ? `<span class="product-old-price">${formatEgp(p.old_price)}</span>` : '';
      return `
        <a href="product.html?id=${encodeURIComponent(id)}" class="product-card-link">
          <article class="product-card" data-product-id="${id}">
            <div class="product-img-wrap">
              ${p?.is_best_seller ? '<span class="product-badge bestseller">Best Seller</span>' : ''}
              <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='https://placehold.co/420x560/f8f8f8/b7b7b7?text=Asian3DFrames';" />
            </div>
            <div class="product-info">
              <h3 class="product-name">${name}</h3>
              <div class="product-footer">
                <div class="product-price-row">
                  ${Number(p?.price || 0) > 0 ? `<span class="product-price">${formatEgp(p.price)}</span>` : ''}
                  ${old}
                </div>
              </div>
            </div>
          </article>
        </a>
      `;
    }).join('');
  }

  async function initProductsPage() {
    const isProducts = Boolean(qs('[data-page="products"]'));
    const isDetail = Boolean(qs('[data-page="product-detail"]'));
    if (!isProducts && !isDetail) return;

    ensureAddToCart();

    cachedCategories = await fetchCategories();
    renderFooterShopLinks(cachedCategories);
    if (isProducts) renderCategoryStrip(cachedCategories);

    try {
      if (isProducts) {
        const products = await fetchProducts();
        mountProductsPage(products);
      }

      if (isDetail) {
        const params = new URLSearchParams(location.search);
        const id = Number(params.get('id'));
        const customMode = params.get('custom') === '1';
        const uploadedPreview = localStorage.getItem('g4y_uploaded_preview_image') || '';
        const allProducts = await fetchProducts();

        if (id > 0) {
          const product = await fetchOneProduct(id);
          mountProductDetail(product, {
            overrideImage: customMode && uploadedPreview ? uploadedPreview : '',
          });
          mountDetailFeatured(product.id, allProducts);
          return;
        }

        if (customMode && uploadedPreview) {
          if (!allProducts.length) throw new Error('No products available right now.');
          mountProductDetail(allProducts[0], { overrideImage: uploadedPreview });
          mountDetailFeatured(allProducts[0].id, allProducts);
          return;
        }

        notify('Invalid product link.', 'error');
      }
    } catch (err) {
      const errBox = qs('#pageError');
      if (errBox) {
        errBox.textContent = err.message || 'Failed to load products.';
        errBox.style.display = 'block';
      } else {
        notify(err.message || 'Failed to load products.', 'error');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductsPage);
  } else {
    initProductsPage();
  }
})();
