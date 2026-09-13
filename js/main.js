// ==========================================
// 1. CÀI ĐẶT SMOOTH SCROLL (LENIS)
// ==========================================
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);


// ==========================================
// 2. HIỆU ỨNG CHUYỂN ĐỘNG & VIDEO INTRO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // Hàm chạy hiệu ứng hiện chữ trang chủ
    function playHomeAnimations() {
        if(document.querySelector(".title")) {
            const tl = gsap.timeline();
            tl.to(".title", { y: 0, opacity: 1, duration: 1.5, ease: "power4.out", delay: 0.3 }) 
              .to(".subtitle", { opacity: 1, duration: 1, ease: "power2.out" }, "-=1")
              .to(".btn-luxury:not(#skip-btn)", { y: 0, opacity: 1, duration: 1, ease: "power2.out" }, "-=0.5");
        }
    }

    // Logic xử lý Intro Video
    const introScreen = document.getElementById("intro-screen");
    const introVideo = document.getElementById("intro-video");
    const skipBtn = document.getElementById("skip-btn");

    if (introScreen && introVideo) {
        const hasSeenIntro = sessionStorage.getItem("lamboIntroSeen");
        if (hasSeenIntro === "true") {
            introScreen.style.display = "none";
            playHomeAnimations();
        } else {
            introVideo.play();
            const finishIntro = () => {
                gsap.to(introScreen, {
                    opacity: 0, duration: 1,
                    onComplete: () => {
                        introScreen.style.display = "none";
                        sessionStorage.setItem("lamboIntroSeen", "true");
                        playHomeAnimations();
                    }
                });
            };
            introVideo.addEventListener("ended", finishIntro);
            if (skipBtn) skipBtn.addEventListener("click", finishIntro);
        }
    }

    // Hiệu ứng các trang khác
    if(document.querySelector(".animate-fade")) {
        gsap.from(".animate-fade", { opacity: 0, duration: 1.5, ease: "power2.out" });
        gsap.from(".animate-slide-up", { y: 50, opacity: 0, duration: 1.5, ease: "power3.out", delay: 0.3 });
    }
});


// ==========================================
// 3. QUẢN LÝ GIỎ HÀNG (LOCAL STORAGE)
// ==========================================
let cart = JSON.parse(localStorage.getItem('lamboCart')) || [];

function formatMoney(amount) {
    return "$" + amount.toLocaleString('en-US');
}

function updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) cartCountElement.innerText = cart.length;
}
updateCartCount();

function addToCart(id, name, price, image) {
    cart.push({ id, name, price, image });
    localStorage.setItem('lamboCart', JSON.stringify(cart));
    updateCartCount();
    
    const btn = document.querySelector('.btn-full');
    if (btn) {
        btn.innerText = "ĐÃ THÊM VÀO GARAGE!";
        btn.style.background = "#d4af37";
        btn.style.color = "#000";
        setTimeout(() => {
            btn.innerText = "ĐƯA VÀO BỘ SƯU TẬP (GIỎ HÀNG)";
            btn.style.background = "transparent";
            btn.style.color = "#d4af37";
        }, 2000);
    }
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const summary = document.getElementById('cart-summary');
    const totalPriceEl = document.getElementById('total-price');

    if (!container) return;
    container.innerHTML = "";

    if (cart.length === 0) {
        container.innerHTML = "<div class='empty-cart'>Garage của bạn đang trống.</div>";
        if(summary) summary.style.display = "none";
        return;
    }

    let totalPrice = 0;
    cart.forEach((item, index) => {
        totalPrice += item.price;
        container.innerHTML += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-info">
                    <h3>${item.name}</h3>
                    <p>${formatMoney(item.price)}</p>
                </div>
                <button class="btn-remove" onclick="removeFromCart(${index})">XÓA</button>
            </div>
        `;
    });

    if(summary) {
        summary.style.display = "block";
        totalPriceEl.innerText = formatMoney(totalPrice);
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('lamboCart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

document.addEventListener("DOMContentLoaded", renderCart);

// ==========================================
// 4. HIỂN THỊ CÁC DÒNG XE
// ==========================================
const models = [
    {
        name: "REVUELTO",
        category: "V12 HYBRID",
        price: "$608,358",
        image: "image/revuelto.jpg",
        description: "Mẫu V12 hybrid hiệu suất cao với thiết kế thế hệ mới."
    },
    {
        name: "TEMERARIO",
        category: "V8 TWIN-TURBO",
        price: "$357,000",
        image: "image/temerario.jpg",
        description: "Siêu xe thể thao mạnh mẽ, kết hợp công nghệ hybrid tiên tiến."
    }
];

function renderModels() {
    const modelsGrid = document.getElementById("models-grid");

    if (!modelsGrid) return;

    modelsGrid.innerHTML = models.map((model) => `
        <article class="model-card">
            <img class="model-card-image" src="${model.image}" alt="${model.name}">
            <div class="model-card-content">
                <p class="model-card-category">${model.category}</p>
                <h3 class="model-card-title">${model.name}</h3>
                <p class="model-card-description">${model.description}</p>
                <div class="model-card-footer">
                    <span class="model-card-price">${model.price}</span>
                    <a class="model-card-link" href="detail.html">XEM CHI TIẾT</a>
                </div>
            </div>
        </article>
    `).join("");
}

document.addEventListener("DOMContentLoaded", renderModels);