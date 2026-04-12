/*
	Asian3DFrames - Global Frontend Script
	Shared vanilla JS utilities for ecommerce pages.
*/

(() => {
	"use strict";

	const CART_KEY = "cart";
	const FRAME_TYPES = ["mobile", "normal"];
	const FRAME_SIZES = [
		"A1", "A2", "A3", "A4", "2 FEET X 4 FEET", // mobile and normal
		"4 FEET X 4 FEET", "4 FEET X 6 FEET", "4 FEET X 8 FEET", "CUSTOMISED SIZE" // normal only
	];
	const FRAME_COLORS = ["gray", "black", "white"];

	// ---------------------------------------------------------------------------
	// Shared helpers
	// ---------------------------------------------------------------------------
	const qs = (sel, root = document) => root.querySelector(sel);
	const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

	const parseJSON = (value, fallback) => {
		try {
			return JSON.parse(value);
		} catch (_err) {
			return fallback;
		}
	};

	const normalizeFrameType = (value) => {
		const next = String(value || "").trim().toLowerCase();
		return FRAME_TYPES.includes(next) ? next : "normal";
	};

	const normalizeFrameSize = (value) => {
		const next = String(value || "").trim().toUpperCase();
		return FRAME_SIZES.includes(next) ? next : "A4";
	};

	const normalizeFrameColor = (value, frameType = "normal") => {
		const next = String(value || "").trim().toLowerCase();
		const type = normalizeFrameType(frameType);
		if (type === "mobile") {
			return ["gray", "black"].includes(next) ? next : "gray";
		}
		return ["white", "black"].includes(next) ? next : "white";
	};

	const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

	// ---------------------------------------------------------------------------
	// Toast notification system for user feedback
	// ---------------------------------------------------------------------------
	function ensureToastStyles() {
		if (qs("#g4y-toast-styles")) return;

		const style = document.createElement("style");
		style.id = "g4y-toast-styles";
		style.textContent = `
			.g4y-toast-wrap {
				position: fixed;
				top: 88px;
				right: 18px;
				z-index: 9999;
				display: flex;
				flex-direction: column;
				gap: 10px;
				pointer-events: none;
			}
			.g4y-toast {
				pointer-events: auto;
				background: #111827;
				color: #fff;
				border-radius: 12px;
				padding: 10px 14px;
				min-width: 220px;
				max-width: min(88vw, 320px);
				font: 500 13px/1.35 Inter, Arial, sans-serif;
				box-shadow: 0 10px 28px rgba(0,0,0,.24);
				opacity: 0;
				transform: translateY(-10px);
				animation: g4yToastIn .24s ease forwards;
			}
			.g4y-toast.success { background: linear-gradient(135deg, #0f9d58, #087f46); }
			.g4y-toast.error { background: linear-gradient(135deg, #d93025, #b3261e); }
			.g4y-toast.hide {
				animation: g4yToastOut .22s ease forwards;
			}
			@keyframes g4yToastIn {
				to { opacity: 1; transform: translateY(0); }
			}
			@keyframes g4yToastOut {
				to { opacity: 0; transform: translateY(-8px); }
			}
			@media (max-width: 640px) {
				.g4y-toast-wrap {
					right: 10px;
					left: 10px;
					top: 78px;
				}
				.g4y-toast { max-width: 100%; }
			}
		`;
		document.head.appendChild(style);
	}

	function showToast(message, type = "success", timeout = 1800) {
		ensureToastStyles();

		let wrap = qs(".g4y-toast-wrap");
		if (!wrap) {
			wrap = document.createElement("div");
			wrap.className = "g4y-toast-wrap";
			document.body.appendChild(wrap);
		}

		const el = document.createElement("div");
		el.className = `g4y-toast ${type}`;
		el.textContent = message;
		wrap.appendChild(el);

		window.setTimeout(() => {
			el.classList.add("hide");
			window.setTimeout(() => el.remove(), 240);
		}, timeout);
	}

	// ---------------------------------------------------------------------------
	// Cart helpers (supports both legacy {qty,img} and new {quantity,image})
	// ---------------------------------------------------------------------------
	function normalizeCartItem(item) {
		const id = Number(item?.id);
		if (!Number.isFinite(id) || id <= 0) return null;

		const quantityRaw = Number(item?.quantity ?? item?.qty ?? 1);
		const quantity = clamp(Number.isFinite(quantityRaw) ? quantityRaw : 1, 1, 99);
		const frameType = normalizeFrameType(item?.frame_type);
		const frameSize = normalizeFrameSize(item?.frame_size);
		const frameColor = normalizeFrameColor(item?.frame_color, frameType);
		const customPhoto = String(item?.custom_photo ?? "").trim();
		const image = String(item?.image ?? item?.img ?? "");
		const inferredPhoto = /^(data:image\/|uploads\/)/i.test(image.trim()) ? image.trim() : "";
		const effectiveCustomPhoto = customPhoto || inferredPhoto;

		let customPhotoKey = "";
		if (effectiveCustomPhoto) {
			if (/^data:image\//i.test(effectiveCustomPhoto)) {
				const tail = effectiveCustomPhoto.slice(-24);
				customPhotoKey = `::cp:data:${effectiveCustomPhoto.length}:${tail}`;
			} else {
				customPhotoKey = `::cp:path:${effectiveCustomPhoto.toLowerCase()}`;
			}
		}

		const defaultLineKey = `${id}::${frameType}::${frameSize}::${frameColor}${customPhotoKey}`;
		const lineKey = String(item?.line_key || defaultLineKey);

		return {
			id,
			name: String(item?.name ?? "Product"),
			price: Number(item?.price ?? 0) || 0,
			image,
			custom_photo: effectiveCustomPhoto,
			quantity,
			frame_type: frameType,
			frame_size: frameSize,
			frame_color: frameColor,
			line_key: lineKey
		};
	}

	function getCart() {
		const raw = localStorage.getItem(CART_KEY);
		const data = parseJSON(raw, []);
		if (!Array.isArray(data)) return [];
		return data.map(normalizeCartItem).filter(Boolean);
	}

	function saveCart(cart) {
		localStorage.setItem(CART_KEY, JSON.stringify(cart));
	}

	function upsertCartItem(item) {
		const next = normalizeCartItem(item);
		if (!next) return;

		const cart = getCart();
		const existing = cart.find((x) => x.line_key === next.line_key);

		if (existing) {
			existing.quantity = clamp(existing.quantity + next.quantity, 1, 99);
		} else {
			cart.push(next);
		}

		saveCart(cart);
	}

	// ---------------------------------------------------------------------------
	// 4) Product frame options (type + size)
	// ---------------------------------------------------------------------------
	function setupProductFrameOptions() {
		const typeButtons = qsa("[data-frame-type]");
		const sizeButtons = qsa("[data-frame-size]");
		const colorButtons = qsa("[data-frame-color]");
		const frameTypeHint = qs("#frameTypeHint");
		if (!typeButtons.length || !sizeButtons.length) return;

		let selectedFrameType = normalizeFrameType(typeButtons.find((btn) => btn.classList.contains("is-selected"))?.dataset.frameType || typeButtons[0]?.dataset.frameType);
		let selectedFrameSize = normalizeFrameSize(sizeButtons.find((btn) => btn.classList.contains("is-selected"))?.dataset.frameSize || sizeButtons[0]?.dataset.frameSize);
		let selectedFrameColor = normalizeFrameColor(colorButtons.find((btn) => btn.classList.contains("is-selected") && !btn.hidden)?.dataset.frameColor, selectedFrameType);
		let hasChosenType = false;
		let hasChosenSize = false;

		const frameTypeOptions = qs("#frameTypeOptions");
		const frameSizeOptions = qs("#frameSizeOptions");
		const frameTypeBlock = frameTypeOptions ? frameTypeOptions.closest(".option-block") : null;
		const frameSizeBlock = frameSizeOptions ? frameSizeOptions.closest(".option-block") : null;

		const clearMissingState = () => {
			if (frameTypeBlock) frameTypeBlock.classList.remove("g4y-option-missing");
			if (frameSizeBlock) frameSizeBlock.classList.remove("g4y-option-missing");
		};

		const ensureValidColorForType = () => {
			selectedFrameColor = normalizeFrameColor(selectedFrameColor, selectedFrameType);
		};

		const syncSizeVisibility = () => {
			const allowedFor = selectedFrameType;
			sizeButtons.forEach((btn) => {
				const forType = String(btn.dataset.frameFor || "").toLowerCase();
				const visible = !forType || forType === allowedFor;
				btn.hidden = !visible;
				btn.disabled = !visible;
			});
		};

		const ensureValidSizeForType = () => {
			const visibleSizes = sizeButtons
				.filter((btn) => !btn.hidden && !btn.disabled)
				.map((btn) => normalizeFrameSize(btn.dataset.frameSize));
			if (!visibleSizes.length) return;
			if (!visibleSizes.includes(selectedFrameSize)) {
				selectedFrameSize = visibleSizes[0];
			}
		};

		const syncColorVisibility = () => {
			if (!colorButtons.length) return;
			const allowedFor = selectedFrameType;
			colorButtons.forEach((btn) => {
				const visible = String(btn.dataset.frameFor || "").toLowerCase() === allowedFor;
				btn.hidden = !visible;
				btn.disabled = !visible;
			});
		};

		const syncButtons = () => {
			typeButtons.forEach((btn) => {
				const active = normalizeFrameType(btn.dataset.frameType) === selectedFrameType;
				btn.classList.toggle("is-selected", active);
				btn.setAttribute("aria-pressed", active ? "true" : "false");
			});
			if (frameTypeHint) {
				frameTypeHint.textContent = selectedFrameType === "mobile"
					? "Mobile Frame: Slim bezel, glossy photo finish, and warm backlight effect."
					: "Normal Frame: Classic thicker bezel, matte look, and supports large/custom sizes.";
			}
			syncSizeVisibility();
			ensureValidSizeForType();
			sizeButtons.forEach((btn) => {
				const active = !btn.hidden && normalizeFrameSize(btn.dataset.frameSize) === selectedFrameSize;
				btn.classList.toggle("is-selected", active);
				btn.setAttribute("aria-pressed", active ? "true" : "false");
			});
			if (colorButtons.length) {
				syncColorVisibility();
				ensureValidColorForType();
				colorButtons.forEach((btn) => {
					const active = !btn.hidden && normalizeFrameColor(btn.dataset.frameColor, selectedFrameType) === selectedFrameColor;
					btn.classList.toggle("is-selected", active);
					btn.setAttribute("aria-pressed", active ? "true" : "false");
				});
			}
			
			// Toggle cart/buy buttons vs contact buttons based on frame size
			const isCustomised = selectedFrameSize === "CUSTOMISED SIZE";
			const addBtn = qs("#addToCartBtn");
			const buyBtn = qs("#buyNowBtn");
			const callBtn = qs("#callBtn");
			const whatsappBtn = qs("#whatsappBtn");
			if (addBtn) addBtn.style.display = isCustomised ? "none" : "inline-flex";
			if (buyBtn) buyBtn.style.display = isCustomised ? "none" : "inline-flex";
			if (callBtn) callBtn.style.display = isCustomised ? "inline-flex" : "none";
			if (whatsappBtn) whatsappBtn.style.display = isCustomised ? "inline-flex" : "none";
		};

		typeButtons.forEach((btn) => {
			btn.addEventListener("click", () => {
				hasChosenType = true;
				clearMissingState();
				selectedFrameType = normalizeFrameType(btn.dataset.frameType);
				ensureValidSizeForType();
				ensureValidColorForType();
				syncButtons();
			});
		});

		sizeButtons.forEach((btn) => {
			btn.addEventListener("click", () => {
				hasChosenSize = true;
				clearMissingState();
				selectedFrameSize = normalizeFrameSize(btn.dataset.frameSize);
				syncButtons();
			});
		});

		colorButtons.forEach((btn) => {
			btn.addEventListener("click", () => {
				if (btn.hidden || btn.disabled) return;
				selectedFrameColor = normalizeFrameColor(btn.dataset.frameColor, selectedFrameType);
				syncButtons();
			});
		});

		syncButtons();

		window.g4yGetSelectedFrameOptions = () => ({
			frame_type: selectedFrameType,
			frame_size: selectedFrameSize,
			frame_color: selectedFrameColor
		});

		window.g4yValidateRequiredFrameOptions = () => {
			clearMissingState();
			const missing = [];
			if (!hasChosenType) {
				missing.push("frame type");
				if (frameTypeBlock) frameTypeBlock.classList.add("g4y-option-missing");
			}
			if (!hasChosenSize) {
				missing.push("frame size");
				if (frameSizeBlock) frameSizeBlock.classList.add("g4y-option-missing");
			}

			if (!missing.length) return true;

			const focusTarget = !hasChosenType
				? (frameTypeOptions || frameTypeBlock)
				: (frameSizeOptions || frameSizeBlock);
			if (focusTarget && typeof focusTarget.scrollIntoView === "function") {
				focusTarget.scrollIntoView({ behavior: "smooth", block: "center" });
			}

			showToast("Please select frame type and size.", "error", 2400);
			window.alert(`Please select ${missing.join(" and ")} before continuing.`);
			return false;
		};
	}

	function cartCount() {
		const raw = parseJSON(localStorage.getItem(CART_KEY), []);
		if (!Array.isArray(raw)) return 0;
		return raw.reduce((sum, item) => {
			const qty = Number(item?.quantity ?? item?.qty ?? 0);
			return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
		}, 0);
	}

	function updateCartBadges() {
		const count = cartCount();
		const badgeSelectors = ["#cartBadge", ".cart-badge", "[data-cart-count]"];
		badgeSelectors.forEach((sel) => {
			qsa(sel).forEach((el) => {
				if (el.tagName === "INPUT") {
					el.value = String(count);
				} else {
					el.textContent = String(count);
				}
				if (el.classList && el.classList.contains("cart-badge")) {
					el.classList.toggle("visible", count > 0);
					// Fallback in case page-level CSS or stale cache blocks class-based visibility.
					el.style.opacity = count > 0 ? "1" : "0";
					el.style.transform = count > 0 ? "scale(1)" : "scale(0)";
				}
			});
		});
	}

	// ---------------------------------------------------------------------------
	// 1) Mobile Navbar Toggle
	// ---------------------------------------------------------------------------
	function setupMobileNavToggle() {
		const hamburger = qs("#hamburger, .hamburger, [data-nav-toggle]");
		const navLinks = qs("#navLinks, .nav-links, [data-nav-menu]");
		if (!hamburger || !navLinks) return;

		const toggle = () => {
			hamburger.classList.toggle("active");
			navLinks.classList.toggle("active");
			document.body.classList.toggle("nav-open");
		};

		hamburger.addEventListener("click", toggle);

		qsa("a", navLinks).forEach((link) => {
			link.addEventListener("click", () => {
				hamburger.classList.remove("active");
				navLinks.classList.remove("active");
				document.body.classList.remove("nav-open");
			});
		});
	}

	// ---------------------------------------------------------------------------
	// 2) Product Card Hover Effect (image zoom)
	// ---------------------------------------------------------------------------
	function setupProductHoverEffect() {
		if (!qs("#g4y-hover-style")) {
			const style = document.createElement("style");
			style.id = "g4y-hover-style";
			style.textContent = `
				.g4y-hover-ready img {
					transition: transform .42s cubic-bezier(.2,.6,.2,1), filter .35s ease;
					will-change: transform;
				}
				.g4y-hover-ready:hover img {
					transform: scale(1.06);
					filter: saturate(1.04);
				}
			`;
			document.head.appendChild(style);
		}

		const imageWraps = qsa(".product-img-wrap, .product-image, .product-card .item-media");
		imageWraps.forEach((wrap) => {
			if (qs("img", wrap)) wrap.classList.add("g4y-hover-ready");
		});
	}

	// ---------------------------------------------------------------------------
	// 3) Photo Upload Preview
	// ---------------------------------------------------------------------------
	function setupPhotoUploadPreview() {
		const input = qs("#photoInput, #photoFile, input[type='file'][data-preview-target]");
		if (!input) return;

		const preview = qs("#previewImage, #uploadPreviewImg, [data-upload-preview]");
		if (!preview) return;

		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) return;
			if (!file.type.startsWith("image/")) {
				showToast("Please choose an image file.", "error");
				return;
			}

			const reader = new FileReader();
			reader.onload = (event) => {
				preview.src = String(event.target?.result || "");
				preview.style.display = "block";
				preview.classList.remove("hidden");
			};
			reader.readAsDataURL(file);
		});
	}

	// ---------------------------------------------------------------------------
	// 5) Add to Cart Button feedback + global addToCart function
	// ---------------------------------------------------------------------------
	function setupAddToCartHandlers() {
		// Support inline onclick calls present in current templates.
		if (typeof window.addToCart !== "function") {
			window.addToCart = (id, name, price, image, quantity = 1, selectedOptions = null) => {
				const options = selectedOptions || (typeof window.g4yGetSelectedFrameOptions === "function"
					? window.g4yGetSelectedFrameOptions()
					: { frame_type: "normal", frame_size: "A4" });

				const frameType = normalizeFrameType(options?.frame_type);
				const frameSize = normalizeFrameSize(options?.frame_size);
				const frameColor = normalizeFrameColor(options?.frame_color, frameType);
				const qty = clamp(Number(quantity) || 1, 1, 99);

				upsertCartItem({ id, name, price, image, quantity: qty, frame_type: frameType, frame_size: frameSize, frame_color: frameColor });
				fetch("php/add_to_cart.php", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						product_id: Number(id),
						quantity: qty,
						frame_type: frameType,
						frame_size: frameSize,
						frame_color: frameColor
					})
				}).catch(() => {});
				updateCartBadges();
				showToast("Item added to cart", "success");
			};
		}

		// Support declarative buttons: data-add-to-cart + data attributes.
		qsa("[data-add-to-cart]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const frameType = normalizeFrameType(btn.dataset.frameType);
				const frameSize = normalizeFrameSize(btn.dataset.frameSize);
				const item = {
					id: Number(btn.dataset.id),
					name: btn.dataset.name,
					price: Number(btn.dataset.price || 0),
					image: btn.dataset.image || "",
					quantity: 1,
					frame_type: frameType,
					frame_size: frameSize
				};
				upsertCartItem(item);
				updateCartBadges();
				showToast("Item added to cart", "success");
			});
		});
	}

	// ---------------------------------------------------------------------------
	// 6) Quantity Increment/Decrement for product forms
	// ---------------------------------------------------------------------------
	function setupQuantityControls() {
		document.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;

			const button = target.closest("[data-qty-action], .qty-plus, .qty-minus");
			if (!button) return;

			const action = button.dataset.qtyAction || (button.classList.contains("qty-plus") ? "inc" : "dec");

			let input = null;
			const targetSelector = button.dataset.qtyTarget;
			if (targetSelector) input = qs(targetSelector);
			if (!input) {
				const scope = button.closest(".qty-control, .quantity-control, .product-qty, .qty");
				if (scope) input = qs("input[type='number']", scope);
			}
			if (!input) return;

			const min = Number(input.min || 1) || 1;
			const max = Number(input.max || 99) || 99;
			const step = Number(input.step || 1) || 1;
			const current = Number(input.value || min) || min;

			const next = action === "inc" ? current + step : current - step;
			input.value = String(clamp(next, min, max));
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
		});
	}

	// ---------------------------------------------------------------------------
	// 7) Smooth Scrolling for internal anchors
	// ---------------------------------------------------------------------------
	function setupSmoothScrolling() {
		document.addEventListener("click", (event) => {
			const link = event.target instanceof Element ? event.target.closest("a[href^='#']") : null;
			if (!link) return;

			const href = link.getAttribute("href");
			if (!href || href === "#") return;

			const target = qs(href);
			if (!target) return;

			event.preventDefault();
			target.scrollIntoView({ behavior: "smooth", block: "start" });
		});
	}

	// ---------------------------------------------------------------------------
	// 8) Sticky Navbar behavior on scroll
	// ---------------------------------------------------------------------------
	function setupStickyNavbar() {
		const nav = qs("#navbar, .navbar");
		if (!nav) return;

		const onScroll = () => {
			const active = window.scrollY > 24;
			nav.classList.toggle("scrolled", active);
			nav.classList.toggle("is-sticky", active);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
	}

	// ---------------------------------------------------------------------------
	// 8) Image Lazy Loading
	// ---------------------------------------------------------------------------
	function setupLazyLoading() {
		const images = qsa("img");
		images.forEach((img) => {
			if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
			if (!img.hasAttribute("decoding")) img.setAttribute("decoding", "async");
		});

		// IntersectionObserver fallback for data-src patterns.
		const deferred = qsa("img[data-src]");
		if (!deferred.length) return;

		if (!("IntersectionObserver" in window)) {
			deferred.forEach((img) => {
				img.src = img.dataset.src || img.src;
				img.removeAttribute("data-src");
			});
			return;
		}

		const io = new IntersectionObserver((entries, observer) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				const img = entry.target;
				img.src = img.dataset.src || img.src;
				img.removeAttribute("data-src");
				observer.unobserve(img);
			});
		}, { rootMargin: "120px 0px" });

		deferred.forEach((img) => io.observe(img));
	}

	// ---------------------------------------------------------------------------
	// 9) Basic checkout form validation (name, phone, address)
	// ---------------------------------------------------------------------------
	function setupCheckoutValidation() {
		const form = qs("#checkoutForm, form[data-checkout]");
		if (!form) return;

		const firstName = qs("#firstName, input[name='name'], input[name='first_name']", form);
		const phone = qs("#phone, input[name='phone']", form);
		const address = qs("#address, textarea[name='address'], input[name='address']", form);

		const showError = (field, message) => {
			if (!field) return;
			const id = field.id ? `e_${field.id}` : "";
			const err = id ? qs(`#${id}`) : null;
			if (err) err.textContent = message || "";
			field.classList.toggle("invalid", !!message);
			field.setAttribute("aria-invalid", message ? "true" : "false");
		};

		const validators = [
			{
				field: firstName,
				check: (v) => /^[a-zA-Z\u0600-\u06FF\s]{2,}$/.test(v.trim()),
				msg: "Please enter a valid name."
			},
			{
				field: phone,
				check: (v) => /^\+?[0-9\s-]{8,15}$/.test(v.trim()),
				msg: "Please enter a valid phone number."
			},
			{
				field: address,
				check: (v) => v.trim().length >= 8,
				msg: "Please enter your full address."
			}
		];

		const validateField = (entry) => {
			if (!entry.field) return true;
			const value = String(entry.field.value || "");
			const ok = entry.check(value);
			showError(entry.field, ok ? "" : entry.msg);
			return ok;
		};

		validators.forEach((entry) => {
			if (!entry.field) return;
			entry.field.addEventListener("blur", () => validateField(entry));
			entry.field.addEventListener("input", () => {
				if (entry.field.classList.contains("invalid")) validateField(entry);
			});
		});

		form.addEventListener("submit", (event) => {
			const allValid = validators.every(validateField);
			if (!allValid) {
				event.preventDefault();
				showToast("Please fix the highlighted fields.", "error");
			}
		});
	}

	// ---------------------------------------------------------------------------
	// 10) Admin Add Product (multipart form + image upload)
	// ---------------------------------------------------------------------------
	function setupAdminAddProductForm() {
		const form = qs("#addProductForm");
		if (!form) return;

		const nameInput = qs("#pName", form);
		const descInput = qs("#pDesc", form);
		const priceInput = qs("#pPrice", form);
		const oldPriceInput = qs("#pOldPrice", form);
		const categoryInput = qs("#pCategory", form);
		const stockInput = qs("#pStock", form);
		const bestSellerInput = qs("#pBestSeller", form);
		const imageInput = qs("#pImage", form);
		const submitBtn = qs("#submitBtn", form);
		const alertBox = qs("#alertBox");

		const imgPreview = qs("#imgPreview");
		const imgPlaceholder = qs("#imgPlaceholder");
		const imgChangeBtn = qs("#imgChangeBtn");
		const previewImg = qs("#previewImg");
		const previewName = qs("#previewName");
		const previewPrice = qs("#previewPrice");
		const previewCat = qs("#previewCat");
		const uploadStatus = qs("#imgUploadStatus");
		const dropZone = qs("#imgUploadZone");

		if (!nameInput || !descInput || !categoryInput || !imageInput || !submitBtn) {
			return;
		}

		const setFieldError = (id, msg) => {
			const el = qs(`#${id}`);
			if (el) el.textContent = msg || "";
		};

		const setAlert = (type, msg) => {
			if (!alertBox) return;
			alertBox.className = `alert ${type}`;
			alertBox.textContent = msg;
			alertBox.style.display = "block";
		};

		const resetAlert = () => {
			if (!alertBox) return;
			alertBox.style.display = "none";
			alertBox.textContent = "";
		};

		const updatePreview = () => {
			if (previewName) {
				previewName.innerHTML = nameInput.value.trim() || '<span class="placeholder-text">Product Name</span>';
			}
			if (previewPrice) {
				if (priceInput) {
					const v = Number(priceInput.value || 0);
					previewPrice.innerHTML = v > 0 ? `${v.toFixed(0)}` : '<span class="placeholder-text">Price</span>';
				} else {
					previewPrice.innerHTML = '<span class="placeholder-text">Price ₹</span>';
				}
			}
			if (previewCat) {
				const selected = categoryInput.options && categoryInput.selectedIndex >= 0
					? categoryInput.options[categoryInput.selectedIndex]
					: null;
				previewCat.textContent = selected ? selected.textContent : (categoryInput.value || "Category");
			}
		};
		window.updatePreview = updatePreview;

		const getSelectedImages = () => Array.from(imageInput.files || []);

		const setImageStatus = (files) => {
			if (!uploadStatus) return;
			if (!files.length) {
				uploadStatus.innerHTML = "";
				return;
			}

			uploadStatus.innerHTML = `<span style="color:var(--mid)">${files.length} image${files.length === 1 ? "" : "s"} ready for upload</span>`;
		};

		const previewFile = (file) => {
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e) => {
				if (imgPreview) {
					imgPreview.src = String(e.target?.result || "");
					imgPreview.style.display = "block";
				}
				if (previewImg) {
					previewImg.src = String(e.target?.result || "");
				}
				if (imgPlaceholder) imgPlaceholder.style.display = "none";
				if (imgChangeBtn) imgChangeBtn.style.display = "block";
			};
			reader.readAsDataURL(file);
		};

		const validateForm = () => {
			let ok = true;
			const price = priceInput ? Number(priceInput.value || 0) : 0;
			const stock = stockInput ? Number(stockInput.value || -1) : 0;
			const files = getSelectedImages();

			setFieldError("e_pName", nameInput.value.trim() ? "" : "Required.");
			setFieldError("e_pDesc", descInput.value.trim() ? "" : "Required.");
			if (priceInput) {
				setFieldError("e_pPrice", price > 0 ? "" : "Enter a valid price.");
			}
			setFieldError("e_pCategory", categoryInput.value ? "" : "Select a category.");
			if (stockInput) {
				setFieldError("e_pStock", stock >= 0 ? "" : "Enter a valid stock.");
			}

			if (!files.length) {
				setFieldError("e_pImage", "Please upload at least one image.");
				ok = false;
			} else if (files.length > 6) {
				setFieldError("e_pImage", "You can upload up to 6 images.");
				ok = false;
			} else {
				const invalidType = files.some((file) => !file.type.startsWith("image/"));
				const oversize = files.some((file) => file.size > 5 * 1024 * 1024);
				if (invalidType) {
					setFieldError("e_pImage", "Only image files are allowed.");
					ok = false;
				} else if (oversize) {
					setFieldError("e_pImage", "Each image must be 5 MB or smaller.");
					ok = false;
				} else {
					setFieldError("e_pImage", "");
				}
			}

			if (!nameInput.value.trim() || !descInput.value.trim() || !categoryInput.value) {
				ok = false;
			}
			if (priceInput && !(price > 0)) {
				ok = false;
			}
			if (stockInput && !(stock >= 0)) {
				ok = false;
			}

			return ok;
		};

		[ nameInput, categoryInput, priceInput ].filter(Boolean).forEach((el) => {
			el.addEventListener("input", updatePreview);
			el.addEventListener("change", updatePreview);
		});

		imageInput.addEventListener("change", () => {
			const files = getSelectedImages();
			const file = files[0];
			if (!file) return;
			previewFile(file);
			setImageStatus(files);
		});

		if (dropZone) {
			dropZone.addEventListener("dragover", (e) => {
				e.preventDefault();
				dropZone.style.borderColor = "var(--gold)";
			});
			dropZone.addEventListener("dragleave", () => {
				dropZone.style.borderColor = "";
			});
			dropZone.addEventListener("drop", (e) => {
				e.preventDefault();
				dropZone.style.borderColor = "";
				if (e.dataTransfer?.files?.[0]) {
					imageInput.files = e.dataTransfer.files;
					imageInput.dispatchEvent(new Event("change"));
				}
			});
		}

		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			resetAlert();

			if (!validateForm()) return;

			submitBtn.disabled = true;
			submitBtn.innerHTML = '<div class="spinner"></div> Saving...';

			const formData = new FormData();
			formData.append("name", nameInput.value.trim());
			formData.append("description", descInput.value.trim());
			formData.append("price", String(Number(priceInput?.value || 0)));
			if (oldPriceInput && oldPriceInput.value !== "") {
				formData.append("old_price", String(Number(oldPriceInput.value)));
			}
			formData.append("category_id", categoryInput.value);
			// Backward compatibility: older endpoints may still read "category"
			formData.append("category", categoryInput.value);
			formData.append("stock", String(Number(stockInput?.value || 0)));
			formData.append("is_best_seller", bestSellerInput?.checked ? "1" : "0");
			getSelectedImages().forEach((file) => {
				formData.append("images[]", file);
			});

			try {
				const endpoint = new URL("../php/add_product.php", window.location.href).toString();
				const res = await fetch(endpoint, {
					method: "POST",
					headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" },
					body: formData
				});
				const raw = await res.text();
				const clean = raw.replace(/^\uFEFF/, "").trim();

				let data;
				try {
					data = JSON.parse(clean);
				} catch {
					const firstBrace = clean.indexOf("{");
					const lastBrace = clean.lastIndexOf("}");
					if (firstBrace !== -1 && lastBrace > firstBrace) {
						const possibleJson = clean.slice(firstBrace, lastBrace + 1);
						try {
							data = JSON.parse(possibleJson);
						} catch {
							data = null;
						}
					}

					if (!data) {
						if (clean.startsWith("<")) {
							throw new Error("Server returned HTML instead of JSON. Please check Apache/PHP error log.");
						}
						throw new Error("Invalid server response");
					}
				}

				if (!res.ok || data.status !== "success") {
					throw new Error(data.message || "Upload failed");
				}

				setAlert("success", `✓ ${data.message}`);
				form.reset();
				if (imgPreview) imgPreview.style.display = "none";
				if (imgPlaceholder) imgPlaceholder.style.display = "block";
				if (imgChangeBtn) imgChangeBtn.style.display = "none";
				if (previewImg) previewImg.src = "https://placehold.co/320x180/faf7f4/c8956c?text=Product+Image";
				setImageStatus([]);
				updatePreview();
				window.scrollTo({ top: 0, behavior: "smooth" });
			} catch (err) {
				setAlert("error", `✗ ${err.message || "Upload failed"}`);
			} finally {
				submitBtn.disabled = false;
				submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Product';
			}
		});

		updatePreview();
	}

	// ---------------------------------------------------------------------------
	// 11) Product mockup preview studio (canvas layered renderer)
	// ---------------------------------------------------------------------------
	function setupProductMockupStudio() {
						const currentMainImageSrc = document.getElementById('pImage')?.getAttribute('src') || 'https://placehold.co/80x80/f8f8f8/b7b7b7?text=Main';
								// --- Random mockup selector ---
								const allMockups = [
										{ scene: "living_table", src: "assets/mockups/image0.png", alt: "Living Table" },
										{ scene: "image1", src: "assets/mockups/image1.png", alt: "Mockup 1" },
										{ scene: "image2", src: "assets/mockups/image2.png", alt: "Mockup 2" },
										{ scene: "image3", src: "assets/mockups/image3.png", alt: "Mockup 3" },
										{ scene: "image4", src: "assets/mockups/image4.png", alt: "Mockup 4" },
										{ scene: "image5", src: "assets/mockups/image5.png", alt: "Mockup 5" },
										{ scene: "image6", src: "assets/mockups/image6.png", alt: "Mockup 6" },
										{ scene: "image7", src: "assets/mockups/image7.png", alt: "Mockup 7" },
										{ scene: "image8", src: "assets/mockups/image8.png", alt: "Mockup 8" }
								];
								function shuffle(arr) {
										for (let i = arr.length - 1; i > 0; i--) {
												const j = Math.floor(Math.random() * (i + 1));
												[arr[i], arr[j]] = [arr[j], arr[i]];
										}
										return arr;
								}
								const randomMockups = shuffle([...allMockups]).slice(0, 4);
								// Render mockup buttons
								const mockupScenes = document.querySelector(".mockup-scenes");
								if (mockupScenes) {
										mockupScenes.innerHTML = `
												<button class="mockup-scene-tab" type="button" role="tab" data-scene="main_image">
													<img id="mainMockupThumb" src="${currentMainImageSrc}" alt="Main Image" class="mockup-thumb" />
												</button>
												${randomMockups.map(m => `
													<button class="mockup-scene-tab" type="button" role="tab" data-scene="${m.scene}">
														<img src="${m.src}" alt="${m.alt}" class="mockup-thumb" />
													</button>
												`).join("")}
										`;
										// Connect main image preview
										const mockupBtns = mockupScenes.querySelectorAll('.mockup-scene-tab');
										mockupBtns.forEach((btn, idx) => {
												btn.addEventListener('click', () => {
														mockupBtns.forEach(b => b.classList.remove('is-active'));
														btn.classList.add('is-active');
														if (btn.dataset.scene === 'main_image') {
																// Show main product image in preview
																const mainImage = document.getElementById('pImage');
																if (mainImage) {
																		const canvas = document.getElementById('mockupCanvas');
																		const ctx = canvas.getContext('2d');
																		const img = new Image();
																		img.onload = function() {
																				canvas.width = img.width;
																				canvas.height = img.height;
																				ctx.clearRect(0, 0, canvas.width, canvas.height);
																				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
																		};
																		img.src = mainImage.src;
																}
														} else {
																// Trigger normal mockup draw
																if (typeof draw === 'function') draw();
														}
												});
										});
								}
				// --- Mockup scene tab navigation ---
				const mockupButtons = document.querySelectorAll(".mockup-scene-tab");
				let currentMockup = 0;

				// Helper: Activate mockup button and trigger preview
				function activateMockup(index) {
					mockupButtons.forEach(btn => btn.classList.remove("is-active"));
					const btn = mockupButtons[index];
					if (btn) {
						btn.classList.add("is-active");
						btn.click(); // Triggers preview update
					}
				}

				// Sync index when mockup button is clicked directly
				mockupButtons.forEach((btn, idx) => {
					btn.addEventListener("click", () => {
						currentMockup = idx;
						activateMockup(currentMockup);
					});
				});
		const canvas = qs("#mockupCanvas");
		const stage = qs("#mockupCanvasWrap");
		if (!canvas || !stage) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Upload controls removed: mockup always uses main product image
		const frameTypeLabel = qs("#mockupFrameType");
		const frameSizeLabel = qs("#mockupFrameSize");

		const sceneConfig = {
						living_table: { src: "assets/mockups/image0.png", baseRect: { x: 0.50, y: 0.321, w: 0.32, h: 0.315 } },
			image0: { src: "assets/mockups/image0.png", baseRect: { x: 0.50, y: 0.321, w: 0.367, h: 0.335 } },
			image1: { src: "assets/mockups/image1.png", baseRect: { x: 0.55, y: 0.205, w: 0.30, h: 0.46 } },
			image2: { src: "assets/mockups/image2.png", baseRect: { x: 0.20, y: 0.12, w: 0.2, h: 0.16 } },
			image3: { src: "assets/mockups/image3.png", baseRect: { x: 0.290, y: 0.23, w: 0.3, h: 0.3 } },
			image4: { src: "assets/mockups/image4.png", baseRect: { x: 0.50, y: 0.215, w: 0.36, h: 0.34 } },
			image5: { src: "assets/mockups/image5.png", baseRect: { x: 0.50, y: 0.22, w: 0.3, h: 0.3 } },
			image6: { src: "assets/mockups/image6.png", baseRect: { x: 0.50, y: 0.31, w: 0.3, h: 0.3 } },
			image7: { src: "assets/mockups/image7.png", baseRect: { x: 0.50, y: 0.24, w: 0.28, h: 0.29 } },
			image8: { src: "assets/mockups/image8.png", baseRect: { x: 0.70, y: 0.24, w: 0.286, h: 0.274 } }
		};

		const frameAssets = {
			mobile: "assets/frames/mobile-frame.png",
			normal: "assets/frames/normal-frame.png"
		};

		const sizeAspectMap = {
			A1: 1 / Math.SQRT2,
			A2: 1 / Math.SQRT2,
			A3: 1 / Math.SQRT2,
			A4: 1 / Math.SQRT2,
			"2 FEET X 4 FEET": 0.5,
			"4 FEET X 4 FEET": 1,
			"4 FEET X 6 FEET": 2 / 3,
			"4 FEET X 8 FEET": 0.5,
			"CUSTOMISED SIZE": 1
		};

		const sizeScaleMap = {
			A1: 1.04,
			A2: 0.98,
			A3: 0.92,
			A4: 0.8,
			"2 FEET X 4 FEET": 1.0,
			"4 FEET X 4 FEET": 1.02,
			"4 FEET X 6 FEET": 1.03,
			"4 FEET X 8 FEET": 1.04,
			"CUSTOMISED SIZE": 1.1
		};

		const landscapeSizeScaleMap = {
			A1: 1.16,
			A2: 1.08,
			A3: 0.96,
			A4: 0.84,
			"2 FEET X 4 FEET": 1.08,
			"4 FEET X 4 FEET": 1.0,
			"4 FEET X 6 FEET": 1.05,
			"4 FEET X 8 FEET": 1.12,
			"CUSTOMISED SIZE": 1.14
		};

		const cache = new Map();
		const state = {
			scene: "living_table",
			photo: null,
			photoName: "No photo selected",
			hasUserUpload: false,
			photoOrientation: "vertical"
		};

		const escSrc = (src) => String(src || "").trim();

		const syncMainMockupThumb = (src) => {
			const thumb = qs("#mainMockupThumb");
			if (!thumb) return;
			const safe = escSrc(src);
			if (!safe) return;
			thumb.setAttribute("src", safe);
		};

		const getCurrentOptions = () => {
			const selectedType = qs("[data-frame-type].is-selected")?.dataset.frameType || "mobile";
			const rawSize = qs("[data-frame-size].is-selected")?.dataset.frameSize || "A4";
			const rawColor = qs("[data-frame-color].is-selected")?.dataset.frameColor || "";
			const frameType = String(selectedType).toLowerCase() === "mobile" ? "mobile" : "normal";
			const frameSize = String(rawSize || "A4").toUpperCase();
			const frameColor = normalizeFrameColor(rawColor, frameType);
			return { frameType, frameSize, frameColor };
		};

		const syncMeta = () => {
			const options = getCurrentOptions();
			if (frameTypeLabel) frameTypeLabel.textContent = options.frameType === "mobile" ? "Mobile" : "Normal";
			if (frameSizeLabel) frameSizeLabel.textContent = options.frameSize;
		};

		const setRendering = (value) => {
			stage.classList.toggle("is-rendering", Boolean(value));
		};

		const readImage = (src) => {
			const key = escSrc(src);
			if (!key) return Promise.reject(new Error("Empty image path"));
			if (cache.has(key)) return Promise.resolve(cache.get(key));

			return new Promise((resolve, reject) => {
				const img = new Image();
				img.decoding = "async";
				img.onload = () => {
					cache.set(key, img);
					resolve(img);
				};
				img.onerror = () => reject(new Error(`Failed to load image: ${key}`));
				img.src = key;
			});
		};

		const coverDraw = (image, x, y, w, h) => {
			const scale = Math.max(w / image.width, h / image.height);
			const drawW = image.width * scale;
			const drawH = image.height * scale;
			const dx = x + (w - drawW) / 2;
			const dy = y + (h - drawH) / 2;
			ctx.drawImage(image, dx, dy, drawW, drawH);
		};

		const containDraw = (image, x, y, w, h) => {
			const scale = Math.min(w / image.width, h / image.height);
			const drawW = image.width * scale;
			const drawH = image.height * scale;
			const dx = x + (w - drawW) / 2;
			const dy = y + (h - drawH) / 2;
			ctx.drawImage(image, dx, dy, drawW, drawH);
		};

		const getOrientedRatio = (frameSize, orientation) => {
			const baseRatio = sizeAspectMap[frameSize] || sizeAspectMap.A4;
			if (orientation === "horizontal") {
				return Math.abs(baseRatio - 1) < 0.001 ? baseRatio : 1 / baseRatio;
			}
			return baseRatio;
		};

		const rectFromScene = (scene, frameSize, orientation) => {
			const conf = sceneConfig[scene] || sceneConfig.living_table;
			const base = conf.baseRect;
			const baseW = canvas.width * base.w;
			const baseH = canvas.height * base.h;
			const cx = canvas.width * base.x;
			const cy = canvas.height * base.y;
			const ratio = getOrientedRatio(frameSize, orientation);
			const sizeScale = orientation === "horizontal"
				? (landscapeSizeScaleMap[frameSize] || 1)
				: (sizeScaleMap[frameSize] || 1);
			const orientationBoost = orientation === "horizontal" ? 1.28 : 1;

			let targetW = baseW;
			let targetH = targetW / ratio;
			if (targetH > baseH) {
				targetH = baseH;
				targetW = targetH * ratio;
			}

			targetW *= (sizeScale * orientationBoost);
			targetH *= (sizeScale * orientationBoost);

			// Keep the frame inside canvas even for larger sizes.
			const maxW = canvas.width * (orientation === "horizontal" ? 0.96 : 0.92);
			const maxH = canvas.height * (orientation === "horizontal" ? 0.96 : 0.92);
			if (targetW > maxW || targetH > maxH) {
				const fitScale = Math.min(maxW / targetW, maxH / targetH);
				targetW *= fitScale;
				targetH *= fitScale;
			}

			return {
				x: cx - targetW / 2,
				y: cy - targetH / 2,
				w: targetW,
				h: targetH
			};
		};

		const drawFrame = (frameImg, rect, frameType, frameColor, orientation = "vertical") => {
			const baseThickness = frameType === "mobile" ? Math.max(6, rect.w * 0.032) : Math.max(8, rect.w * 0.045);
			const thickness = orientation === "horizontal" ? Math.max(4, baseThickness * 0.68) : baseThickness;
			const ox = rect.x - thickness;
			const oy = rect.y - thickness;
			const ow = rect.w + thickness * 2;
			const oh = rect.h + thickness * 2;
			const tone = String(frameColor || "").toLowerCase();
			const colorMap = {
				black: { base: "#1f232b", edge: "rgba(245,245,245,.28)", texture: .18 },
				gray: { base: "#8d949d", edge: "rgba(245,245,245,.30)", texture: .16 },
				white: { base: "#f3f0ea", edge: "rgba(26,21,16,.26)", texture: .12 }
			};
			const style = colorMap[tone] || colorMap.black;

			const pattern = ctx.createPattern(frameImg, "repeat");
			const drawBars = (fillStyle) => {
				ctx.fillStyle = fillStyle;
				ctx.fillRect(ox, oy, ow, thickness);
				ctx.fillRect(ox, oy + oh - thickness, ow, thickness);
				ctx.fillRect(ox, oy + thickness, thickness, oh - thickness * 2);
				ctx.fillRect(ox + ow - thickness, oy + thickness, thickness, oh - thickness * 2);
			};

			ctx.save();
			drawBars(style.base);
			if (pattern) {
				ctx.globalAlpha = style.texture;
				drawBars(pattern);
			}
			ctx.restore();

			ctx.save();
			ctx.strokeStyle = style.edge;
			ctx.lineWidth = Math.max(2, thickness * 0.09);
			ctx.strokeRect(ox + 3, oy + 3, ow - 6, oh - 6);
			ctx.restore();
		};

		const drawBacklightGlow = (rect, frameType) => {
			if (frameType !== "mobile") return;
			const cx = rect.x + rect.w / 2;
			const cy = rect.y + rect.h / 2;
			const innerR = Math.max(rect.w, rect.h) * 0.89;
			const outerR = Math.max(rect.w, rect.h) * 0.82;

			ctx.save();
			ctx.beginPath();
			ctx.rect(rect.x, rect.y, rect.w, rect.h);
			ctx.clip();
			ctx.globalCompositeOperation = "screen";
			const warmBloom = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
			warmBloom.addColorStop(0, "rgba(255, 248, 225, 0.68)");
			warmBloom.addColorStop(0.42, "rgba(248, 220, 165, 0.36)");
			warmBloom.addColorStop(0.78, "rgba(236, 196, 120, 0.18)");
			warmBloom.addColorStop(1, "rgba(236, 196, 120, 0)");
			ctx.fillStyle = warmBloom;
			ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

			const topAura = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
			topAura.addColorStop(0, "rgba(255, 251, 239, 0.25)");
			topAura.addColorStop(0.38, "rgba(255, 241, 210, 0.12)");
			topAura.addColorStop(1, "rgba(255, 241, 210, 0)");
			ctx.fillStyle = topAura;
			ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
			ctx.restore();
		};

		const drawPhotoGloss = (rect, frameType) => {
			if (frameType !== "mobile") return;

			const gloss = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
			gloss.addColorStop(0, "rgba(255,255,255,.30)");
			gloss.addColorStop(0.28, "rgba(255,255,255,.12)");
			gloss.addColorStop(0.55, "rgba(255,255,255,.03)");
			gloss.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = gloss;
			ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

			// Subtle diagonal highlight gives a glassy look.
			const sweep = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
			sweep.addColorStop(0, "rgba(255,255,255,.20)");
			sweep.addColorStop(0.22, "rgba(255,255,255,.06)");
			sweep.addColorStop(0.45, "rgba(255,255,255,0)");
			ctx.fillStyle = sweep;
			ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
		};

		const setTabState = () => {
			qsa(".mockup-scene-tab").forEach((btn) => {
				btn.classList.toggle("is-active", btn.dataset.scene === state.scene);
			});
		};

		const draw = async () => {
			const options = getCurrentOptions();
			syncMeta();
			setRendering(true);

			try {
				if (state.scene === "main_image") {
					// Show main product image only, no mockup
					const mainImage = qs("#pImage");
					if (mainImage) {
						const img = await readImage(mainImage.src);
						canvas.width = img.width;
						canvas.height = img.height;
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						containDraw(img, 0, 0, canvas.width, canvas.height);
					}
					return;
				}
				const scene = sceneConfig[state.scene] || sceneConfig.living_table;
				const [sceneImg, frameImg] = await Promise.all([
					readImage(scene.src),
					readImage(frameAssets[options.frameType])
				]);

				// Match canvas to scene aspect to avoid automatic zoom/cropping.
				if (canvas.width !== sceneImg.width || canvas.height !== sceneImg.height) {
					canvas.width = sceneImg.width;
					canvas.height = sceneImg.height;
				}

				ctx.clearRect(0, 0, canvas.width, canvas.height);
				containDraw(sceneImg, 0, 0, canvas.width, canvas.height);

				const rect = rectFromScene(state.scene, options.frameSize, state.photoOrientation);
				ctx.save();
				ctx.shadowColor = "rgba(0,0,0,.22)";
				ctx.shadowBlur = 28;
				ctx.shadowOffsetY = 10;
				ctx.fillStyle = "rgba(0,0,0,.16)";
				ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
				ctx.restore();

				ctx.save();
				ctx.beginPath();
				ctx.rect(rect.x, rect.y, rect.w, rect.h);
				ctx.clip();
				if (state.photo) {
					// Use cover so photo fills frame opening without top/bottom gaps.
					coverDraw(state.photo, rect.x, rect.y, rect.w, rect.h);
					drawBacklightGlow(rect, options.frameType);
					drawPhotoGloss(rect, options.frameType);
				} else {
					ctx.fillStyle = "#d9d9dd";
					ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
					drawBacklightGlow(rect, options.frameType);
					drawPhotoGloss(rect, options.frameType);
				}
				ctx.restore();

				drawFrame(frameImg, rect, options.frameType, options.frameColor, state.photoOrientation);
			} catch (_err) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = "#ece9e3";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = "#5e5549";
				ctx.font = "600 20px Manrope, sans-serif";
				ctx.fillText("Mockup assets could not be loaded.", 48, 70);
			} finally {
				window.setTimeout(() => setRendering(false), 180);
			}
		};

		const setPhotoFromUrl = async (src, name = "Product photo") => {
			const safe = escSrc(src);
			if (!safe) return;
			try {
				const image = await readImage(safe);
				if (!state.hasUserUpload) {
					state.photo = image;
					state.photoName = name;
					draw();
				}
			} catch (_err) {}
		};

		// Upload logic removed: mockup always uses main product image

		qsa(".mockup-scene-tab").forEach((tab) => {
			tab.addEventListener("click", () => {
				state.scene = tab.dataset.scene || "living_table";
				setTabState();
				if (typeof window.g4yShowMediaSlide === "function") window.g4yShowMediaSlide(1);
				draw();
			});
		});

		qsa("[data-photo-orientation]").forEach((control) => {
			control.addEventListener("click", () => {
				const orientation = control.dataset.photoOrientation === "horizontal" ? "horizontal" : "vertical";
				state.photoOrientation = orientation;
				qsa("[data-photo-orientation]").forEach((btn) => {
					const isActive = btn.dataset.photoOrientation === orientation;
					btn.classList.toggle("is-active", isActive);
					btn.setAttribute("aria-pressed", isActive ? "true" : "false");
				});
				draw();
			});
		});

		document.addEventListener("click", (event) => {
			const control = event.target instanceof Element ? event.target.closest("[data-frame-type], [data-frame-size], [data-frame-color]") : null;
			if (!control) return;
			window.setTimeout(draw, 0);
		});

		const mainImage = qs("#pImage");
		if (mainImage) {
			const watch = new MutationObserver(() => {
				const src = mainImage.getAttribute("src");
				syncMainMockupThumb(src);
				setPhotoFromUrl(src, "Product photo");
			});
			watch.observe(mainImage, { attributes: true, attributeFilter: ["src"] });
			syncMainMockupThumb(mainImage.getAttribute("src"));
			setPhotoFromUrl(mainImage.getAttribute("src"), "Product photo");
		}

		// Custom preview logic removed: mockup always uses main product image

		syncMeta();
		setTabState();
		draw();
	}

	function setupProductMediaSlider() {
		const slider = qs("#mediaSlider");
		const track = qs("#mediaSliderTrack");
		if (!slider || !track) return;

		const slides = qsa(".media-slide", slider);
		const dots = qsa(".media-dot", slider.parentElement || document);
		const prev = qs("#mediaPrev");
		const next = qs("#mediaNext");
		if (!slides.length) return;

		let index = 0;
		const max = slides.length - 1;

		const sync = () => {
			track.style.transform = `translateX(-${index * 100}%)`;
			dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
		};

		const goTo = (value) => {
			index = Math.max(0, Math.min(max, Number(value) || 0));
			sync();
		};

		prev?.addEventListener("click", () => goTo((index - 1 + slides.length) % slides.length));
		next?.addEventListener("click", () => goTo((index + 1) % slides.length));
		dots.forEach((dot) => {
			dot.addEventListener("click", () => goTo(Number(dot.dataset.mediaIndex || 0)));
		});

		window.g4yShowMediaSlide = goTo;
		sync();
	}

	function setupProductImageZoomViewer() {
		const triggerImage = qs("#pImage");
		if (!triggerImage) return;

		if (!qs("#g4y-zoom-style")) {
			const style = document.createElement("style");
			style.id = "g4y-zoom-style";
			style.textContent = `
				.g4y-zoom-overlay {
					position: fixed;
					inset: 0;
					z-index: 2000;
					background: rgba(12, 10, 8, 0.88);
					display: none;
					align-items: center;
					justify-content: center;
					padding: 20px;
				}
				.g4y-zoom-overlay.is-open { display: flex; }
				.g4y-zoom-wrap {
					position: relative;
					width: min(92vw, 1200px);
					height: min(88vh, 900px);
					background: linear-gradient(180deg, #111318, #1d232f);
					border: 1px solid rgba(255,255,255,.2);
					border-radius: 14px;
					overflow: hidden;
				}
				.g4y-zoom-stage {
					width: 100%;
					height: 100%;
					display: grid;
					place-items: center;
					cursor: grab;
					touch-action: none;
				}
				.g4y-zoom-stage.is-dragging { cursor: grabbing; }
				.g4y-zoom-stage img {
					max-width: 100%;
					max-height: 100%;
					transform-origin: center center;
					transition: transform .12s ease;
					user-select: none;
					-webkit-user-drag: none;
				}
				.g4y-zoom-toolbar {
					position: absolute;
					top: 10px;
					right: 10px;
					display: flex;
					gap: 0;
					z-index: 1;
				}
				.g4y-zoom-btn {
					width: 36px;
					height: 36px;
					border-radius: 10px;
					border: 1px solid rgba(255,255,255,.34);
					background: rgba(15, 15, 18, .72);
					color: #fff;
					font-size: 18px;
					line-height: 1;
					cursor: pointer;
				}
				.g4y-zoom-btn:hover { background: rgba(26, 26, 30, .92); }
				.g4y-zoom-hint {
					position: absolute;
					left: 12px;
					bottom: 12px;
					padding: 6px 10px;
					font-size: .75rem;
					border-radius: 999px;
					background: rgba(15, 15, 18, .66);
					border: 1px solid rgba(255,255,255,.24);
					color: #e8eaee;
				}
				@media (max-width: 760px) {
					.g4y-zoom-overlay { padding: 10px; }
					.g4y-zoom-wrap {
						width: 100vw;
						height: 100vh;
						border-radius: 0;
						border: 0;
					}
				}
			`;
			document.head.appendChild(style);
		}

		const overlay = document.createElement("div");
		overlay.className = "g4y-zoom-overlay";
		overlay.innerHTML = `
			<div class="g4y-zoom-wrap" role="dialog" aria-modal="true" aria-label="Image zoom viewer">
				<div class="g4y-zoom-toolbar">
					<button type="button" class="g4y-zoom-btn" data-zoom-action="close" aria-label="Close viewer">×</button>
				</div>
				<div class="g4y-zoom-stage" data-zoom-stage>
					<img alt="Zoomed product preview" draggable="false" />
				</div>
				<div class="g4y-zoom-hint">Desktop: mouse wheel to zoom. Mobile: pinch and drag. Esc to close.</div>
			</div>
		`;
		document.body.appendChild(overlay);

		const stage = qs("[data-zoom-stage]", overlay);
		const image = qs("img", stage);
		const clampZoom = (v) => Math.max(1, Math.min(4, v));
		let zoom = 1;
		let offsetX = 0;
		let offsetY = 0;
		let wasDragging = false;
		let panPointerId = null;
		let panStartX = 0;
		let panStartY = 0;
		let panOriginX = 0;
		let panOriginY = 0;
		let pinchStartDistance = 0;
		let pinchStartZoom = 1;
		const pointers = new Map();

		const getPointerDistance = () => {
			const values = Array.from(pointers.values());
			if (values.length < 2) return 0;
			const a = values[0];
			const b = values[1];
			return Math.hypot(a.x - b.x, a.y - b.y);
		};

		const clampPan = () => {
			if (!stage || !image || zoom <= 1) {
				offsetX = 0;
				offsetY = 0;
				return;
			}
			const maxX = Math.max(0, (image.offsetWidth * zoom - stage.clientWidth) / 2);
			const maxY = Math.max(0, (image.offsetHeight * zoom - stage.clientHeight) / 2);
			offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
			offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
		};

		const applyZoom = () => {
			if (!image) return;
			clampPan();
			image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
		};

		const openViewer = (src, altText) => {
			if (!image || !src) return;
			image.src = src;
			image.alt = altText || "Zoomed product preview";
			zoom = 1;
			offsetX = 0;
			offsetY = 0;
			wasDragging = false;
			pointers.clear();
			applyZoom();
			overlay.classList.add("is-open");
			document.body.style.overflow = "hidden";
		};

		const closeViewer = () => {
			overlay.classList.remove("is-open");
			document.body.style.overflow = "";
			stage?.classList.remove("is-dragging");
			pointers.clear();
			panPointerId = null;
		};

		triggerImage.style.cursor = "zoom-in";
		triggerImage.addEventListener("click", () => {
			openViewer(triggerImage.currentSrc || triggerImage.src, triggerImage.alt || "Product image");
		});

		overlay.addEventListener("click", (event) => {
			const target = event.target instanceof Element ? event.target : null;
			const actionBtn = target ? target.closest("[data-zoom-action]") : null;
			if (actionBtn) {
				const action = actionBtn.getAttribute("data-zoom-action");
				if (action === "close") closeViewer();
				return;
			}

			if (target === overlay) closeViewer();
		});

		stage?.addEventListener("wheel", (event) => {
			if (!overlay.classList.contains("is-open")) return;
			event.preventDefault();
			zoom = clampZoom(zoom + (event.deltaY < 0 ? 0.16 : -0.16));
			if (zoom <= 1) {
				offsetX = 0;
				offsetY = 0;
			}
			applyZoom();
		}, { passive: false });

		stage?.addEventListener("pointerdown", (event) => {
			if (!overlay.classList.contains("is-open")) return;
			stage.setPointerCapture(event.pointerId);
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (pointers.size === 1 && zoom > 1) {
				panPointerId = event.pointerId;
				panStartX = event.clientX;
				panStartY = event.clientY;
				panOriginX = offsetX;
				panOriginY = offsetY;
				stage.classList.add("is-dragging");
			}
			if (pointers.size === 2) {
				pinchStartDistance = getPointerDistance();
				pinchStartZoom = zoom;
				panPointerId = null;
				stage.classList.remove("is-dragging");
			}
		});

		stage?.addEventListener("pointermove", (event) => {
			if (!overlay.classList.contains("is-open")) return;
			if (!pointers.has(event.pointerId)) return;
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

			if (pointers.size === 2) {
				const distance = getPointerDistance();
				if (pinchStartDistance > 0) {
					zoom = clampZoom((distance / pinchStartDistance) * pinchStartZoom);
					if (zoom <= 1) {
						offsetX = 0;
						offsetY = 0;
					}
					applyZoom();
				}
				return;
			}

			if (panPointerId === event.pointerId && zoom > 1) {
				offsetX = panOriginX + (event.clientX - panStartX);
				offsetY = panOriginY + (event.clientY - panStartY);
				if (Math.abs(event.clientX - panStartX) > 3 || Math.abs(event.clientY - panStartY) > 3) {
					wasDragging = true;
				}
				applyZoom();
			}
		});

		const endPointer = (event) => {
			if (!pointers.has(event.pointerId)) return;
			pointers.delete(event.pointerId);
			if (panPointerId === event.pointerId) {
				panPointerId = null;
				stage?.classList.remove("is-dragging");
			}
			if (pointers.size < 2) {
				pinchStartDistance = 0;
			}
		};

		stage?.addEventListener("pointerup", endPointer);
		stage?.addEventListener("pointercancel", endPointer);

		stage?.addEventListener("click", (event) => {
			if (zoom > 1 && !wasDragging) {
				zoom = 1;
				offsetX = 0;
				offsetY = 0;
				applyZoom();
			}
			wasDragging = false;
			event.stopPropagation();
		});

		document.addEventListener("keydown", (event) => {
			if (!overlay.classList.contains("is-open")) return;
			if (event.key === "Escape") {
				event.preventDefault();
				closeViewer();
			}
		});
	}

	function setupAnimatedTestimonials() {
		const marquee = qs(".testimonials-marquee");
		const track = qs("#testimonialsTrack");
		if (!marquee || !track || track.dataset.animated === "true") return;

		const cards = qsa(".testimonial-card", track);
		if (cards.length < 2) return;

		cards.forEach((card) => {
			const clone = card.cloneNode(true);
			clone.setAttribute("aria-hidden", "true");
			track.appendChild(clone);
		});

		track.dataset.animated = "true";
		track.classList.add("is-animated");
	}

	function setupShippingPolicyPopup() {
		if (qs("#g4y-shipping-policy-modal")) return;

		const style = document.createElement("style");
		style.id = "g4y-shipping-policy-style";
		style.textContent = `
			.g4y-policy-overlay {
				position: fixed;
				inset: 0;
				background: rgba(17, 24, 39, 0.65);
				backdrop-filter: blur(2px);
				display: none;
				align-items: center;
				justify-content: center;
				padding: 16px;
				z-index: 99999;
			}
			.g4y-policy-overlay.is-open { display: flex; }
			.g4y-policy-modal {
				width: min(900px, 96vw);
				max-height: 90vh;
				overflow: hidden;
				background: #ffffff;
				border-radius: 16px;
				box-shadow: 0 20px 60px rgba(0,0,0,.25);
				display: flex;
				flex-direction: column;
			}
			.g4y-policy-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				padding: 16px 18px;
				border-bottom: 1px solid rgba(0,0,0,.08);
			}
			.g4y-policy-title {
				margin: 0;
				font: 700 1.15rem/1.2 Manrope, Inter, Arial, sans-serif;
				color: #111827;
			}
			.g4y-policy-close {
				width: 36px;
				height: 36px;
				border: 0;
				border-radius: 10px;
				background: #f3f4f6;
				font-size: 1.2rem;
				line-height: 1;
				cursor: pointer;
			}
			.g4y-policy-close:hover { background: #e5e7eb; }
			.g4y-policy-body {
				padding: 18px;
				overflow: auto;
				font: 500 0.93rem/1.65 Manrope, Inter, Arial, sans-serif;
				color: #374151;
			}
			.g4y-policy-body h4 {
				margin: 14px 0 6px;
				font: 700 1rem/1.3 Manrope, Inter, Arial, sans-serif;
				color: #111827;
			}
			.g4y-policy-body p { margin: 8px 0; }
		`;
		document.head.appendChild(style);

		const overlay = document.createElement("div");
		overlay.className = "g4y-policy-overlay";
		overlay.id = "g4y-shipping-policy-modal";
		overlay.innerHTML = `
			<div class="g4y-policy-modal" role="dialog" aria-modal="true" aria-label="Shipping Policy">
				<div class="g4y-policy-head">
					<h3 class="g4y-policy-title">Shipping Policy</h3>
					<button type="button" class="g4y-policy-close" aria-label="Close">&times;</button>
				</div>
				<div class="g4y-policy-body">
					<p><strong>Effective Date:</strong> 17th December 2025</p>
					<p>Thank you for shopping with Asian3Dframes. This Shipping Policy explains how we process, dispatch, and deliver orders within India and internationally. By placing an order on www.asian3dframes.com, you agree to the terms mentioned below.</p>

					<h4>1. Shipping Coverage</h4>
					<p>We currently offer shipping to:</p>
					<p>All locations across India, including cities, towns, and remote areas.</p>
					<p>International destinations, with worldwide delivery to most countries.</p>
					<p>If your location is not serviceable, we will notify you during the order process.</p>

					<h4>2. Order Processing Time</h4>
					<p>All orders are carefully processed, packed, and dispatched within 2 working days from the date of order confirmation. We ensure safe packaging to protect frames and maintain product quality.</p>

					<h4>3. Delivery Timeline</h4>
					<p><strong>Within India:</strong> Estimated delivery time is 4 to 6 business days after dispatch, depending on the delivery location.</p>
					<p><strong>International Deliveries:</strong> Estimated delivery time is 10 to 15 business days. Delivery time may vary based on customs clearance, destination country regulations, and postal services.</p>
					<p>Please note: weekends, public holidays, and unforeseen circumstances may affect delivery timelines.</p>

					<h4>4. Shipping Charges</h4>
					<p><strong>Domestic Shipping (India):</strong></p>
					<p>Rs 65 for a single product.</p>
					<p>Rs 105 for multiple products in a single order.</p>
					<p><strong>International Shipping:</strong> Charges vary based on destination country, location, and package weight. Final charges will be shown before order confirmation.</p>

					<h4>5. Shipping Partner</h4>
					<p>All orders are shipped via reliable courier services (such as India Post or other logistics partners) to ensure safe and timely delivery.</p>

					<h4>6. Order Tracking</h4>
					<p>Tracking details may not be provided automatically. Customers can contact us anytime for order status updates or shipping-related queries.</p>

					<h4>7. Shipping Delays Disclaimer</h4>
					<p>While we aim for timely delivery, delays may occur due to factors beyond our control such as weather conditions, courier or postal delays, customs clearance for international orders, strikes, or unforeseen disruptions.</p>
					<p>Asian3Dframes is not responsible for delays caused by these external factors.</p>

					<h4>8. Damage During Transit</h4>
					<p>All products are securely packed to minimize damage. However, once the shipment is handed over to the courier, we are not liable for any damage during transit.</p>

					<h4>9. Customer Support</h4>
					<p>For shipping-related queries or assistance:</p>
					<p>Email: asian3dframes@gmail.com</p>
					<p>WhatsApp chat support is available.</p>
					<p>Website: www.asian3dframes.com</p>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);

		const closeBtn = qs(".g4y-policy-close", overlay);
		const close = () => {
			overlay.classList.remove("is-open");
			document.body.style.overflow = "";
		};
		const open = () => {
			overlay.classList.add("is-open");
			document.body.style.overflow = "hidden";
		};

		closeBtn?.addEventListener("click", close);
		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) close();
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
		});

		// Auto-wire existing footer links that read "Shipping Policy".
		qsa("a").forEach((link) => {
			const text = String(link.textContent || "").trim().toLowerCase();
			if (text === "shipping policy") {
				link.setAttribute("href", "#");
				link.setAttribute("data-shipping-policy-trigger", "1");
			}
		});

		document.addEventListener("click", (event) => {
			const trigger = event.target instanceof Element
				? event.target.closest("a[data-shipping-policy-trigger]")
				: null;
			if (!trigger) return;
			event.preventDefault();
			open();
		});
	}

	function setupRefundPolicyPopup() {
		if (qs("#g4y-refund-policy-modal")) return;

		const overlay = document.createElement("div");
		overlay.className = "g4y-policy-overlay";
		overlay.id = "g4y-refund-policy-modal";
		overlay.innerHTML = `
			<div class="g4y-policy-modal" role="dialog" aria-modal="true" aria-label="Refund and Return Policy">
				<div class="g4y-policy-head">
					<h3 class="g4y-policy-title">Refund and Return Policy</h3>
					<button type="button" class="g4y-policy-close" aria-label="Close">&times;</button>
				</div>
				<div class="g4y-policy-body">
					<p><strong>Effective Date:</strong> 17th December 2025</p>
					<p>Thank you for shopping with Asian3Dframes. We take pride in delivering high-quality and well-crafted photo frames. Please read our policy carefully regarding returns and refunds.</p>

					<h4>1. Return Policy</h4>
					<p>We do not accept returns once the product has been delivered. As our products are customized/decorative items, they are considered non-returnable and non-exchangeable under normal conditions such as change of mind, personal preference, incorrect address provided by the customer, or delivery delays due to recipient unavailability.</p>

					<h4>2. Refund Eligibility</h4>
					<p>Refunds will be considered only if the customer does not receive the product within 6 to 8 business days after dispatch confirmation.</p>
					<p>In such cases, the customer must contact us within 2 days after the delivery timeline has passed. The request will be verified with our shipping partner before approval.</p>

					<h4>3. Refund Request Process</h4>
					<p>If your order qualifies for a refund, contact us via email or WhatsApp and provide your Order ID and order details. Additional verification with courier records may be required before approval.</p>

					<h4>4. Refund Method</h4>
					<p>Refunds will be processed to the original payment method. Refund initiation will take 3 to 4 working days after approval. The credited amount may take additional time depending on your bank or payment provider.</p>

					<h4>5. Non-Refundable Conditions</h4>
					<p>Refunds will not be issued if the product is successfully delivered, an incorrect or incomplete address is provided, the customer fails to contact within the allowed time, or the request is based on personal preference or change of mind.</p>

					<h4>6. Replacements</h4>
					<p>We currently do not offer replacements for any products.</p>

					<h4>7. Contact Us</h4>
					<p>For refund-related queries or assistance:</p>
					<p>Email: asian3dframes@gmail.com</p>
					<p>WhatsApp chat support is available.</p>
					<p>Website: www.asian3dframes.com</p>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);

		const closeBtn = qs(".g4y-policy-close", overlay);
		const close = () => {
			overlay.classList.remove("is-open");
			document.body.style.overflow = "";
		};
		const open = () => {
			overlay.classList.add("is-open");
			document.body.style.overflow = "hidden";
		};

		closeBtn?.addEventListener("click", close);
		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) close();
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
		});

		qsa("a").forEach((link) => {
			const text = String(link.textContent || "").trim().toLowerCase();
			if (text === "returns & refunds") {
				link.setAttribute("href", "#");
				link.setAttribute("data-refund-policy-trigger", "1");
			}
		});

		document.addEventListener("click", (event) => {
			const trigger = event.target instanceof Element
				? event.target.closest("a[data-refund-policy-trigger]")
				: null;
			if (!trigger) return;
			event.preventDefault();
			open();
		});
	}

	function setupFaqPopup() {
		if (qs("#g4y-faq-modal")) return;

		const overlay = document.createElement("div");
		overlay.className = "g4y-policy-overlay";
		overlay.id = "g4y-faq-modal";
		overlay.innerHTML = `
			<div class="g4y-policy-modal" role="dialog" aria-modal="true" aria-label="Frequently Asked Questions">
				<div class="g4y-policy-head">
					<h3 class="g4y-policy-title">Frequently Asked Questions (FAQ)</h3>
					<button type="button" class="g4y-policy-close" aria-label="Close">&times;</button>
				</div>
				<div class="g4y-policy-body">
					<h4>1. How do I place an order?</h4>
					<p>You can browse products on www.asian3dframes.com, select your preferred frame, and place your order directly through the website. For custom orders, you can contact us via WhatsApp.</p>

					<h4>2. Do you offer customized frames?</h4>
					<p>Yes. We offer customized frames based on your requirements. You can share your design, photo, or idea through WhatsApp and we will create it for you.</p>

					<h4>3. What are the delivery timelines?</h4>
					<p>Within India: 4 to 6 business days after dispatch. International: 10 to 15 business days. Delivery time may vary based on location and external factors.</p>

					<h4>4. How are the products packed?</h4>
					<p>All frames are securely packed using protective materials to ensure they reach you safely without damage.</p>

					<h4>5. What payment methods do you accept?</h4>
					<p>We accept secure online payments including UPI, debit and credit cards, and other available payment options shown at checkout.</p>

					<h4>6. Can I return or exchange a product?</h4>
					<p>No. We do not accept returns or exchanges once the product is delivered. Please review product details carefully before placing an order.</p>

					<h4>7. When will I get a refund?</h4>
					<p>Refunds are only applicable if the product is not delivered within the specified time. Please refer to our Refund Policy for complete details.</p>

					<h4>8. Do you deliver to all locations?</h4>
					<p>Yes, we deliver across India and to most international locations. If your area is not serviceable, we will inform you during order placement.</p>

					<h4>9. How can I contact customer support?</h4>
					<p>Email: asian3dframes@gmail.com. WhatsApp chat support is available. You can also use the website contact page.</p>

					<h4>10. Are the product images real?</h4>
					<p>Yes, images shown are real product representations. Slight color variations may occur due to lighting or screen settings.</p>

					<h4>11. Can I track my order?</h4>
					<p>Tracking may not be automatically provided. You can contact us anytime for order status updates.</p>

					<h4>12. What if my product is damaged?</h4>
					<p>We ensure safe packaging, but if you receive a damaged product, contact us immediately with photos for assistance.</p>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);

		const closeBtn = qs(".g4y-policy-close", overlay);
		const close = () => {
			overlay.classList.remove("is-open");
			document.body.style.overflow = "";
		};
		const open = () => {
			overlay.classList.add("is-open");
			document.body.style.overflow = "hidden";
		};

		closeBtn?.addEventListener("click", close);
		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) close();
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
		});

		qsa("a").forEach((link) => {
			const text = String(link.textContent || "").trim().toLowerCase();
			if (text === "faq") {
				link.setAttribute("href", "#");
				link.setAttribute("data-faq-trigger", "1");
			}
		});

		document.addEventListener("click", (event) => {
			const trigger = event.target instanceof Element
				? event.target.closest("a[data-faq-trigger]")
				: null;
			if (!trigger) return;
			event.preventDefault();
			open();
		});
	}

	function setupTermsPopup() {
		if (qs("#g4y-terms-modal")) return;

		const overlay = document.createElement("div");
		overlay.className = "g4y-policy-overlay";
		overlay.id = "g4y-terms-modal";
		overlay.innerHTML = `
			<div class="g4y-policy-modal" role="dialog" aria-modal="true" aria-label="Terms and Conditions">
				<div class="g4y-policy-head">
					<h3 class="g4y-policy-title">Terms and Conditions</h3>
					<button type="button" class="g4y-policy-close" aria-label="Close">&times;</button>
				</div>
				<div class="g4y-policy-body">
					<p><strong>Effective Date:</strong> 17th December 2025</p>
					<p>Welcome to Asian3Dframes. By accessing or using our website www.asian3dframes.com, you agree to comply with and be bound by these Terms and Conditions. Please read them carefully before using our services.</p>

					<h4>1. General</h4>
					<p>These Terms govern your use of our website and services. By placing an order, you agree to these Terms. We reserve the right to update or modify these Terms at any time without prior notice.</p>

					<h4>2. Products and Services</h4>
					<p>We offer decorative and customized photo frames. Product images are for representation and slight variations may occur. Customized products are made based on customer inputs.</p>

					<h4>3. Orders and Acceptance</h4>
					<p>All orders are subject to availability and confirmation. We reserve the right to cancel any order due to pricing errors, stock issues, or suspicious activity. Once an order is placed, it cannot be modified or canceled after processing.</p>

					<h4>4. Pricing and Payments</h4>
					<p>All prices are listed in INR unless stated otherwise. We accept payments via secure payment gateways such as UPI and debit or credit cards. We are not responsible for payment failures due to technical issues.</p>

					<h4>5. Shipping and Delivery</h4>
					<p>Orders are processed and delivered as per our Shipping Policy. Delivery timelines are estimates and may vary. We are not liable for delays caused by third-party logistics.</p>

					<h4>6. Returns and Refunds</h4>
					<p>All sales are final with no returns or exchanges. Refunds are applicable only under specific conditions as mentioned in our Refund Policy.</p>

					<h4>7. User Responsibilities</h4>
					<p>You must provide accurate and complete information while placing orders, ensure correct shipping address and contact details, and avoid misuse of the website or fraudulent activity.</p>

					<h4>8. Intellectual Property</h4>
					<p>All content on this website, including images, designs, and text, is the property of Asian3Dframes. Unauthorized use, reproduction, or copying is strictly prohibited.</p>

					<h4>9. Limitation of Liability</h4>
					<p>We are not liable for any indirect, incidental, or consequential damages. Once the product is shipped, responsibility transfers to the courier partner.</p>

					<h4>10. Privacy</h4>
					<p>Your personal information is handled as per our Privacy Policy. We do not share your data with unauthorized third parties.</p>

					<h4>11. Governing Law</h4>
					<p>These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of local courts.</p>

					<h4>12. Contact Us</h4>
					<p>For any queries regarding these Terms:</p>
					<p>Email: asian3dframes@gmail.com</p>
					<p>WhatsApp support is available.</p>
					<p>Website: www.asian3dframes.com</p>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);

		const closeBtn = qs(".g4y-policy-close", overlay);
		const close = () => {
			overlay.classList.remove("is-open");
			document.body.style.overflow = "";
		};
		const open = () => {
			overlay.classList.add("is-open");
			document.body.style.overflow = "hidden";
		};

		closeBtn?.addEventListener("click", close);
		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) close();
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
		});

		qsa("a").forEach((link) => {
			const text = String(link.textContent || "").trim().toLowerCase();
			if (text === "terms of service" || text === "terms & conditions" || text === "terms and conditions") {
				link.setAttribute("href", "#");
				link.setAttribute("data-terms-trigger", "1");
			}
		});

		document.addEventListener("click", (event) => {
			const trigger = event.target instanceof Element
				? event.target.closest("a[data-terms-trigger]")
				: null;
			if (!trigger) return;
			event.preventDefault();
			open();
		});
	}

	function setupDailyVisitorTracking() {
		if (window.location.pathname.includes("/admin/")) return;

		const todayKey = new Date().toISOString().slice(0, 10);
		const storageKey = `g4y_visitor_tracked_${todayKey}`;
		if (window.localStorage.getItem(storageKey) === "1") return;

		fetch("php/track_visitor.php", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "same-origin",
			keepalive: true,
			body: JSON.stringify({ page: window.location.pathname })
		})
			.then(() => {
				window.localStorage.setItem(storageKey, "1");
			})
			.catch(() => {
				// Fail silently to avoid interrupting shopping flow.
			});
	}

	// ---------------------------------------------------------------------------
	// 12) Init
	// ---------------------------------------------------------------------------
	function safeInit(name, fn) {
		try {
			fn();
		} catch (error) {
			console.warn(`Init failed: ${name}`, error);
		}
	}

	function init() {
		// Policy/FAQ popups should always initialize first.
		safeInit("setupShippingPolicyPopup", setupShippingPolicyPopup);
		safeInit("setupRefundPolicyPopup", setupRefundPolicyPopup);
		safeInit("setupFaqPopup", setupFaqPopup);
		safeInit("setupTermsPopup", setupTermsPopup);

		safeInit("setupMobileNavToggle", setupMobileNavToggle);
		safeInit("setupProductHoverEffect", setupProductHoverEffect);
		safeInit("setupPhotoUploadPreview", setupPhotoUploadPreview);
		safeInit("setupProductFrameOptions", setupProductFrameOptions);
		safeInit("setupAddToCartHandlers", setupAddToCartHandlers);
		safeInit("setupQuantityControls", setupQuantityControls);
		safeInit("setupSmoothScrolling", setupSmoothScrolling);
		safeInit("setupStickyNavbar", setupStickyNavbar);
		safeInit("setupLazyLoading", setupLazyLoading);
		safeInit("setupCheckoutValidation", setupCheckoutValidation);
		safeInit("setupAdminAddProductForm", setupAdminAddProductForm);
		safeInit("setupProductMediaSlider", setupProductMediaSlider);
		safeInit("setupAnimatedTestimonials", setupAnimatedTestimonials);
		safeInit("setupDailyVisitorTracking", setupDailyVisitorTracking);
		safeInit("setupProductMockupStudio", setupProductMockupStudio);
		safeInit("updateCartBadges", updateCartBadges);
		// Re-sync in case other scripts mutate localStorage/DOM after init.
		window.setTimeout(() => safeInit("updateCartBadges(timeout-0)", updateCartBadges), 0);
		window.setTimeout(() => safeInit("updateCartBadges(timeout-300)", updateCartBadges), 300);
	}

	window.addEventListener("storage", (event) => {
		if (!event || event.key === CART_KEY || event.key === null) {
			updateCartBadges();
		}
	});

	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) updateCartBadges();
	});

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}

	// Expose cart functions to global scope for checkout page
	window.getCart = getCart;
	window.saveCart = saveCart;
	window.upsertCartItem = upsertCartItem;
	window.cartCount = cartCount;
	window.updateCartBadges = updateCartBadges;
})();

