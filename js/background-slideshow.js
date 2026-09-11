/**
 * Shared Background Slideshow Logic for SmileCare Dental Clinic
 * Rotates 4 background clinic photos with manual Prev/Next arrow navigation support.
 */

(function () {
    const SLIDE_CLASSES = [
        'global-bg-slide-1',
        'global-bg-slide-2',
        'global-bg-slide-3',
        'global-bg-slide-4'
    ];
    const SLIDE_INTERVAL_MS = 4500; // 4.5 seconds per slide transition

    let currentIndex = 0;
    let timerId = null;

    function getSlides() {
        const bgContainer = document.getElementById("globalBgSlideshow");
        const globalSlides = bgContainer ? bgContainer.querySelectorAll(".global-bg-slide") : [];
        const heroSlides = document.querySelectorAll(".hero-slide");
        return { globalSlides, heroSlides };
    }

    function showSlide(index) {
        const { globalSlides, heroSlides } = getSlides();
        const total = globalSlides.length || heroSlides.length || 4;

        // Wrap around index
        if (index < 0) {
            currentIndex = total - 1;
        } else if (index >= total) {
            currentIndex = 0;
        } else {
            currentIndex = index;
        }

        // Update global slides
        if (globalSlides && globalSlides.length > 0) {
            globalSlides.forEach((s, idx) => {
                if (idx === currentIndex) {
                    s.classList.add("active");
                } else {
                    s.classList.remove("active");
                }
            });
        }

        // Update hero slides
        if (heroSlides && heroSlides.length > 0) {
            heroSlides.forEach((s, idx) => {
                if (idx === currentIndex) {
                    s.classList.add("active");
                } else {
                    s.classList.remove("active");
                }
            });
        }
    }

    function startTimer() {
        stopTimer();
        timerId = setInterval(() => {
            showSlide(currentIndex + 1);
        }, SLIDE_INTERVAL_MS);
    }

    function stopTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    window.nextSlideshowImage = function () {
        showSlide(currentIndex + 1);
        startTimer(); // reset timer
    };

    window.prevSlideshowImage = function () {
        showSlide(currentIndex - 1);
        startTimer(); // reset timer
    };

    function initBackgroundSlideshow() {
        // 1. Check or Create Global Background Slideshow Container
        let bgContainer = document.getElementById("globalBgSlideshow");
        if (!bgContainer) {
            bgContainer = document.createElement("div");
            bgContainer.id = "globalBgSlideshow";
            bgContainer.className = "global-bg-slideshow";

            SLIDE_CLASSES.forEach((slideClass, index) => {
                const slideDiv = document.createElement("div");
                slideDiv.className = `global-bg-slide ${slideClass}${index === 0 ? " active" : ""}`;
                bgContainer.appendChild(slideDiv);
            });

            document.body.prepend(bgContainer);
        }

        showSlide(0);
        startTimer();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initBackgroundSlideshow);
    } else {
        initBackgroundSlideshow();
    }
})();
