// home.js - Landing Page Interactive Features & Supabase Integration

document.addEventListener("DOMContentLoaded", function () {
    initStatCounters();
    loadDoctorsFromSupabase();
    initEnquiryModal();
    initScrollAnimations();
    initMobileMenu();
});

// 1. Stat Counters Animation
function initStatCounters() {
    const statNumbers = document.querySelectorAll(".stat-number");
    if (!statNumbers || statNumbers.length === 0) return;

    let animated = false;

    function animateCounters() {
        if (animated) return;
        animated = true;

        statNumbers.forEach(counter => {
            const target = parseInt(counter.getAttribute("data-target"), 10) || 0;
            let current = 0;
            const increment = Math.max(1, Math.ceil(target / 50));
            const duration = 1500;
            const stepTime = Math.max(10, Math.floor(duration / (target / increment)));

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                    counter.textContent = target + (target >= 5 ? "+" : "");
                } else {
                    counter.textContent = current + "+";
                }
            }, stepTime);
        });
    }

    // IntersectionObserver to start counter animation when visible
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.2 });

        const aboutSection = document.getElementById("about");
        if (aboutSection) observer.observe(aboutSection);
    } else {
        animateCounters();
    }
}

// 2. Fetch Doctors from Supabase Database
async function loadDoctorsFromSupabase() {
    const doctorsGrid = document.getElementById("doctorsGrid");
    if (!doctorsGrid || typeof supabaseClient === "undefined" || !supabaseClient) return;

    try {
        const { data: doctors, error } = await supabaseClient
            .from("doctors")
            .select("*")
            .order("id", { ascending: true });

        if (error) throw error;

        if (doctors && doctors.length > 0) {
            doctorsGrid.className = "doctors-container";
            doctorsGrid.innerHTML = doctors.map((doc, idx) => {
                const docId = doc.id || (idx + 1);
                const rawName = doc.name ? String(doc.name).trim() : `Doctor ${idx + 1}`;
                const displayName = rawName.startsWith("Dr.") ? rawName : `Dr. ${rawName}`;
                const spec = doc.specialization || "Dental Specialist";
                const initials = rawName.replace(/^Dr\.\s*/i, '').split(' ').map(n => n[0]).join('').substr(0, 2).toUpperCase() || 'DR';
                
                const shortBio = `${displayName} is a dedicated dental professional specializing in ${spec}, committed to providing quality, patient-focused care with a gentle touch.`;
                const fullBio = doc.bio || `${displayName} brings years of clinical experience in ${spec}. With a strong academic background and commitment to continuous learning, ${displayName.split(' ')[1] || 'the doctor'} focuses on delivering personalized dental care using modern techniques, ensuring every visit is a positive experience.`;
                const photoUrl = (idx === 0) ? 'assets/doctor-1.jpg' : (idx === 1 ? 'assets/doctor-2.jpg' : '');

                return `
                    <div class="doctor-card-showcase animate-on-scroll is-visible">
                        <div class="doctor-left-content">
                            <span class="doctor-badge-tag">👨‍⚕️ ABOUT DOCTOR</span>
                            <h3 class="doctor-full-name">${escapeHtml(displayName)} <span class="doctor-degree">BDS, MDS</span></h3>
                            <div class="doctor-accent-bar"></div>
                            <div class="doctor-spec-pill">${escapeHtml(spec)}</div>

                            <p class="doctor-short-bio">${escapeHtml(shortBio)}</p>

                            <div id="fullBio-${docId}" class="doctor-full-bio-container">
                                <p class="doctor-full-bio-text">${escapeHtml(fullBio)}</p>
                            </div>

                            <button type="button" class="btn-read-more" onclick="toggleDoctorBio('${docId}', this)">
                                <span class="btn-text">Read More</span>
                                <span class="btn-arrow">➔</span>
                            </button>
                        </div>

                        <div class="doctor-right-visual">
                            <div class="dots-pattern-bg"></div>
                            <div class="doctor-image-wrapper">
                                ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(displayName)}" class="doctor-photo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
                                <div class="doctor-avatar-circle" style="${photoUrl ? 'display: none;' : ''}">${escapeHtml(initials)}</div>
                                <div class="doctor-exp-badge">
                                    ⭐ Expert Specialist
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    } catch (err) {
        console.warn("Using default static doctor cards fallback:", err);
    }
}

// 3. Enquiry Modal Logic
function initEnquiryModal() {
    const openBtn = document.getElementById("openEnquireBtn");
    const closeBtn = document.getElementById("closeEnquiryModal");
    const modal = document.getElementById("enquiryModal");
    const form = document.getElementById("enquiryForm");

    if (!modal) return;

    if (openBtn) {
        openBtn.addEventListener("click", function () {
            modal.style.display = "flex";
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", function () {
            modal.style.display = "none";
        });
    }

    modal.addEventListener("click", function (e) {
        if (e.target === modal) modal.style.display = "none";
    });

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            const name = document.getElementById("enquiryName").value;
            alert(`Thank you ${name}! Your enquiry has been received. Our team will contact you shortly.`);
            form.reset();
            modal.style.display = "none";
        });
    }
}

// 4. Hero Background Slideshow is managed globally by background-slideshow.js

// 5. Expandable Doctor Bio Toggle Logic (Read More / Read Less)
function toggleDoctorBio(id, btnElement) {
    const fullBioContainer = document.getElementById(`fullBio-${id}`);
    if (!fullBioContainer) return;

    const btnText = btnElement.querySelector(".btn-text");
    const btnArrow = btnElement.querySelector(".btn-arrow");
    const isExpanded = fullBioContainer.classList.contains("expanded");

    if (isExpanded) {
        fullBioContainer.classList.remove("expanded");
        if (btnText) btnText.textContent = "Read More";
        if (btnArrow) btnArrow.textContent = "➔";
    } else {
        fullBioContainer.classList.add("expanded");
        if (btnText) btnText.textContent = "Read Less";
        if (btnArrow) btnArrow.textContent = "⬆";
    }
}

// 6. Smooth Scroll Fade-In Animations (Intersection Observer)
function initScrollAnimations() {
    if (!("IntersectionObserver" in window)) {
        document.querySelectorAll(".animate-on-scroll").forEach(el => el.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll(".animate-on-scroll").forEach(el => observer.observe(el));
}

// 7. Mobile Navigation Menu Toggle Logic
function initMobileMenu() {
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const mobileNav = document.getElementById("mobileNavDrawer");
    
    if (!mobileBtn || !mobileNav) return;

    mobileBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        const isOpen = mobileNav.classList.contains("active");
        if (isOpen) {
            mobileNav.classList.remove("active");
            mobileBtn.setAttribute("aria-expanded", "false");
            mobileBtn.innerHTML = "☰";
        } else {
            mobileNav.classList.add("active");
            mobileBtn.setAttribute("aria-expanded", "true");
            mobileBtn.innerHTML = "✕";
        }
    });

    mobileNav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", function () {
            mobileNav.classList.remove("active");
            if (mobileBtn) {
                mobileBtn.setAttribute("aria-expanded", "false");
                mobileBtn.innerHTML = "☰";
            }
        });
    });

    document.addEventListener("click", function (e) {
        if (!mobileNav.contains(e.target) && e.target !== mobileBtn) {
            mobileNav.classList.remove("active");
            if (mobileBtn) {
                mobileBtn.setAttribute("aria-expanded", "false");
                mobileBtn.innerHTML = "☰";
            }
        }
    });
}
