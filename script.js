document.addEventListener('DOMContentLoaded', () => {

    // --- Frame Scrubbing Logic ---
    const canvas = document.getElementById('frame-canvas');
    const context = canvas.getContext('2d');
    const heroSection = document.getElementById('hero-scrub');
    
    // Config
    const frameCount = 240;
    const images = [];
    const currentFrame = { index: 0 };
    let imagesLoaded = 0;
    
    // Texts
    const textStart = document.getElementById('text-start');
    const textMid = document.getElementById('text-mid');
    const textFinal = document.getElementById('text-final');

    // Preload Images
    const preloadImages = () => {
        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            // Pads the index. e.g. 1 -> 001, 15 -> 015
            const padIndex = i.toString().padStart(3, '0');
            img.src = `dumbel-frames/ezgif-frame-${padIndex}.jpg`;
            img.onload = () => {
                imagesLoaded++;
                if (imagesLoaded === 1) {
                    // Draw first frame ASAP
                    resizeCanvas();
                    requestAnimationFrame(() => updateCanvas(0));
                    canvas.style.opacity = 1;
                }
            };
            images.push(img);
        }
    };

    // Canvas sizing
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Redraw current frame after resize
        if (imagesLoaded > 0) {
            updateCanvas(currentFrame.index);
        }
    };
    
    window.addEventListener('resize', resizeCanvas);

    // Draw frame onto canvas using aspect-ratio 'contain' or 'cover'
    const updateCanvas = (index) => {
        if (!images[index] || !images[index].complete) return;
        
        const img = images[index];
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate standard 'cover' aspect ratio
        const imgRatio = img.width / img.height;
        const canvasRatio = canvas.width / canvas.height;
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgRatio > canvasRatio) {
            // image is wider than canvas
            drawHeight = canvas.height;
            drawWidth = img.width * (canvas.height / img.height);
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        } else {
            // Canvas is wider than image
            drawWidth = canvas.width;
            drawHeight = img.height * (canvas.width / img.width);
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        }
        
        context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    // Sync Text Function
    const updateText = (progress) => {
        // progress is 0.0 to 1.0
        // Define phases. 
        // 0.0 - 0.2: Fade in start, 0.2 - 0.3 fade out
        // 0.4 - 0.5: Fade in mid, 0.6 - 0.7 fade out
        // 0.8 - 0.9: Fade in final, stays till 1.0
        
        const setOpacityScale = (element, opacity, scale) => {
            element.style.opacity = opacity;
            element.style.transform = `scale(${scale})`;
        };

        // Start text
        if (progress < 0.1) {
            // Fade in
            const p = progress / 0.1; // 0 to 1
            setOpacityScale(textStart, p, 0.95 + 0.05 * p);
        } else if (progress >= 0.1 && progress < 0.25) {
            // hold
            setOpacityScale(textStart, 1, 1);
        } else if (progress >= 0.25 && progress < 0.35) {
            // Fade out
            const p = (progress - 0.25) / 0.1; // 0 to 1
            setOpacityScale(textStart, 1 - p, 1 + 0.05 * p);
        } else {
            setOpacityScale(textStart, 0, 0.95);
        }

        // Mid text
        if (progress > 0.35 && progress < 0.45) {
            const p = (progress - 0.35) / 0.1;
            setOpacityScale(textMid, p, 0.95 + 0.05 * p);
        } else if (progress >= 0.45 && progress < 0.6) {
            setOpacityScale(textMid, 1, 1);
        } else if (progress >= 0.6 && progress < 0.7) {
            const p = (progress - 0.6) / 0.1;
            setOpacityScale(textMid, 1 - p, 1 + 0.05 * p);
        } else {
            setOpacityScale(textMid, 0, 0.95);
        }

        // Final text
        if (progress > 0.7 && progress < 0.8) {
            const p = (progress - 0.7) / 0.1;
            setOpacityScale(textFinal, p, 0.95 + 0.05 * p);
        } else if (progress >= 0.8) {
            setOpacityScale(textFinal, 1, 1);
        } else {
            setOpacityScale(textFinal, 0, 0.95);
        }
    };

    // Scroll handler
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                
                // Calculate scroll progress inside hero section
                const rect = heroSection.getBoundingClientRect();
                const scrollTop = -rect.top;
                // Maximum distance to scroll within the section
                const maxScroll = heroSection.offsetHeight - window.innerHeight;
                
                let progress = scrollTop / maxScroll;
                
                // Clamp progress between 0 and 1
                progress = Math.max(0, Math.min(1, progress));
                
                const frameIndex = Math.min(
                    frameCount - 1,
                    Math.floor(progress * frameCount)
                );
                
                if (frameIndex !== currentFrame.index) {
                    updateCanvas(frameIndex);
                    currentFrame.index = frameIndex;
                }
                
                updateText(progress);
                
                ticking = false;
            });
            ticking = true;
        }
    });

    // Initialize Preloading
    preloadImages();

    // --- Intersection Observer for Animations ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    const fadeElements = document.querySelectorAll('.fade-up');
    fadeElements.forEach(el => observer.observe(el));

    // --- Facilities Drag & Arrow Scroll ---
    const scroller = document.getElementById('facilities-scroller');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');

    if (scroller) {
        let isDown = false;
        let startX;
        let scrollLeft;
        let isHovering = false;
        
        // Auto-Scroll Logic
        let autoScrollSpeed = 0.5;
        let autoScrollDirection = 1; // 1 for right, -1 for left
        let pauseAutoScroll = false; // Used to delay auto-scroll briefly after clicking arrows
        let exactScrollLeft = 0; // Floating point accumulator to avoid scroll truncation

        scroller.parentElement.addEventListener('mouseenter', () => { isHovering = true; });
        scroller.parentElement.addEventListener('mouseleave', () => { isHovering = false; });

        scroller.addEventListener('mousedown', (e) => {
            isDown = true;
            scrollLeft = scroller.scrollLeft;
            startX = e.pageX - scroller.offsetLeft;
            scroller.classList.add('grabbing');
        });

        const release = () => {
            isDown = false;
            scroller.classList.remove('grabbing');
        };

        scroller.addEventListener('mouseleave', release);
        scroller.addEventListener('mouseup', release);

        scroller.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - scroller.offsetLeft;
            const walk = (x - startX) * 2; // scroll-fast multiplier
            scroller.scrollLeft = scrollLeft - walk;
        });

        const temporarilyPauseAuto = () => {
            pauseAutoScroll = true;
            setTimeout(() => pauseAutoScroll = false, 800);
        };

        const scrollByAmount = 350; // Approaching card width + gap
        
        if (leftArrow) {
            leftArrow.addEventListener('click', () => {
                temporarilyPauseAuto();
                scroller.scrollBy({ left: -scrollByAmount, behavior: 'smooth' });
                autoScrollDirection = -1; // Predict intended direction
            });
        }
        
        if (rightArrow) {
            rightArrow.addEventListener('click', () => {
                temporarilyPauseAuto();
                scroller.scrollBy({ left: scrollByAmount, behavior: 'smooth' });
                autoScrollDirection = 1;
            });
        }

        // Initialize accumulator tracking
        setTimeout(() => { exactScrollLeft = scroller.scrollLeft; }, 100);

        const autoScroll = () => {
            if (!isHovering && !isDown && !pauseAutoScroll) {
                exactScrollLeft += autoScrollSpeed * autoScrollDirection;
                
                // Strictly enforce boundaries on the accumulator itself
                const maxScroll = scroller.scrollWidth - scroller.clientWidth;
                if (exactScrollLeft >= maxScroll) {
                    exactScrollLeft = maxScroll;
                } else if (exactScrollLeft <= 0) {
                    exactScrollLeft = 0;
                }

                scroller.scrollLeft = exactScrollLeft;
            } else {
                // Keep accumulator synced when scrolling manually
                exactScrollLeft = scroller.scrollLeft;
            }
            requestAnimationFrame(autoScroll);
        };
        
        // Start auto-scrolling loop
        requestAnimationFrame(autoScroll);
    }

});
