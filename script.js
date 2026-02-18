// --- Dark Mode ---
const themeBtn = document.getElementById("dark-mode-toggle");
themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    const icon = themeBtn.querySelector("i");
    icon.classList.toggle("fa-moon");
    icon.classList.toggle("fa-sun");
});

// --- Typewriter ---
const text = "Welcome to My Digital Space...";
let i = 0;
function type() {
    if (i < text.length) {
        document.getElementById("typewriter").innerHTML += text.charAt(i);
        i++;
        setTimeout(type, 100);
    }
}

// --- Loader ---
window.addEventListener("load", () => {
    const loader = document.getElementById("loader");
    setTimeout(() => {
        loader.classList.add("loader-hidden");
        type();
    }, 1500);
});

// --- Modal Slider ---
const modal = document.getElementById("project-modal");
const slides = document.querySelectorAll(".slide");
const dots = document.querySelectorAll(".dot");
let currentSlide = 0;

function showSlide(index) {
    slides.forEach(s => s.classList.remove("active-slide"));
    dots.forEach(d => d.classList.remove("active-dot"));
    
    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add("active-slide");
    dots[currentSlide].classList.add("active-dot");
}

document.getElementById("projects-trigger").onclick = () => { modal.style.display = "block"; showSlide(0); }
document.querySelector(".close-btn").onclick = () => modal.style.display = "none";
document.querySelector(".prev-btn").onclick = () => showSlide(currentSlide - 1);
document.querySelector(".next-btn").onclick = () => showSlide(currentSlide + 1);

window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }

// Keyboard Support
document.addEventListener("keydown", (e) => {
    if (modal.style.display === "block") {
        if (e.key === "ArrowLeft") showSlide(currentSlide - 1);
        if (e.key === "ArrowRight") showSlide(currentSlide + 1);
        if (e.key === "Escape") modal.style.display = "none";
    }
});