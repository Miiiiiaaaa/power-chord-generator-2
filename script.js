  (function(){
    
  })();

  (function(){
        const btn = document.getElementById('button');
        const video = document.getElementById('soundwave');
        const led = document.getElementById('led');
        const imgEl = document.querySelector('#display3 img');

        // Image list from `chords dithered` folder — picks one at random on button press
        // Use the actual filenames (with '#') here; we'll encode filenames when building URLs.
        const imagePaths = [
            'chords dithered/dither_it_g5.jpg',
            'chords dithered/dither_it_f5.jpg',
            'chords dithered/dither_it_f#5.jpg',
            'chords dithered/dither_it_d5.jpg',
            'chords dithered/dither_it_c5.jpg',
            'chords dithered/dither_it_b5.jpg',
            'chords dithered/dither_it_a5.jpg'
        ];

        // history queue stored as DOM children inside #paper
        const paper = document.getElementById('paper');
        // Prevent browser drag of images inside #paper so pen/mouse can draw instead
        if (paper) {
            paper.addEventListener('dragstart', function (e) { e.preventDefault(); });
        }
        const historySize = 4; // number of scribbles to keep before wrapping
        let historyIndex = 0;  // next position to overwrite in circular buffer

        // Load pen cursor size and hotspot info so drawing aligns with pen tip (bottom-left)
        const penCursor = {
            src: 'images/pen.png',
            hotspotX: 16, // matches CSS cursor declaration
            hotspotY: 16,
            width: 0,
            height: 0,
            loaded: false
        };
        (function loadPen() {
            const img = new Image();
            img.src = penCursor.src;
            img.onload = function () {
                penCursor.width = img.naturalWidth;
                penCursor.height = img.naturalHeight;
                penCursor.loaded = true;
            };
        })();

        // Create an overlay canvas that covers #paper so user can draw freely on the paper
        let paperCanvas, paperCtx;
        function createPaperCanvas() {
            if (!paper) return;
            // If already exists, reuse
            if (paperCanvas && paper.contains(paperCanvas)) return;

            paperCanvas = document.createElement('canvas');
            paperCanvas.className = 'paper-overlay-canvas';
            paperCanvas.style.position = 'absolute';
            paperCanvas.style.left = '0';
            paperCanvas.style.top = '0';
            paperCanvas.style.width = '100%';
            paperCanvas.style.height = '100%';
            paperCanvas.style.zIndex = 999;
            paperCanvas.style.pointerEvents = 'auto';
            paperCanvas.style.touchAction = 'none';

            // Place canvas as first child so scribble thumbnails appear above it if needed
            paper.insertBefore(paperCanvas, paper.firstChild);
            paperCtx = paperCanvas.getContext('2d');

            // Size canvas properly for high-DPI screens
            function resizeCanvas() {
                const rect = paper.getBoundingClientRect();
                // Use CSS pixels for canvas size so pointer coordinates map 1:1 to canvas
                paperCanvas.width = Math.max(1, Math.floor(rect.width));
                paperCanvas.height = Math.max(1, Math.floor(rect.height));
                paperCanvas.style.width = rect.width + 'px';
                paperCanvas.style.height = rect.height + 'px';
            }

            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);

            // Drawing state
            let drawing = false;

            function getPos(e) {
                const rect = paperCanvas.getBoundingClientRect();
                // adjust client coordinates so the pen image's bottom-left maps to pointer
                let clientX = e.clientX;
                let clientY = e.clientY;
                if (penCursor.loaded) {
                    // vector from hotspot to bottom-left: (0 - hotspotX, (height-1) - hotspotY)
                    const dx = (0 - penCursor.hotspotX);
                    const dy = ((penCursor.height - 1) - penCursor.hotspotY);
                    clientX = clientX + dx;
                    clientY = clientY + dy;
                }
                return {
                    x: (clientX - rect.left) * (paperCanvas.width / rect.width),
                    y: (clientY - rect.top) * (paperCanvas.height / rect.height)
                };
            }

            function pointerDown(e) {
                e.preventDefault();
                drawing = true;
                try { paperCanvas.setPointerCapture(e.pointerId); } catch (err) {}
                const p = getPos(e);

                // compute base line width and apply pressure if available
                const base = Math.max(2, Math.round(paperCanvas.width / 300));
                const pressure = (typeof e.pressure === 'number' && e.pressure >= 0) ? e.pressure : 0.5;
                const lw = Math.max(1, Math.round(base * (1 + pressure * 2)));

                paperCtx.lineJoin = 'round';
                paperCtx.lineCap = 'round';
                paperCtx.strokeStyle = '#000000';
                paperCtx.fillStyle = paperCtx.strokeStyle;
                paperCtx.lineWidth = lw;

                // draw a dot at contact point so single taps show up
                paperCtx.beginPath();
                paperCtx.arc(p.x, p.y, Math.max(1, lw / 2), 0, Math.PI * 2);
                paperCtx.fill();

                // start the stroke from the contact point
                paperCtx.beginPath();
                paperCtx.moveTo(p.x, p.y);
            }

            function pointerMove(e) {
                if (!drawing) return;
                const p = getPos(e);
                paperCtx.lineTo(p.x, p.y);
                paperCtx.stroke();
            }

            function pointerUp(e) {
                if (!drawing) return;
                drawing = false;
                try { paperCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
            }

            paperCanvas.addEventListener('pointerdown', pointerDown);
            paperCanvas.addEventListener('pointermove', pointerMove);
            paperCanvas.addEventListener('pointerup', pointerUp);
            paperCanvas.addEventListener('pointercancel', pointerUp);

            // optional: clear overlay on double-click
            paperCanvas.addEventListener('dblclick', function () {
                if (!paperCtx) return;
                paperCtx.clearRect(0, 0, paperCanvas.width, paperCanvas.height);
            });
        }

        // Create the overlay when script runs
        createPaperCanvas();

        function showRandomImage() {
            if (!imgEl || imagePaths.length === 0) return;
            const i = Math.floor(Math.random() * imagePaths.length);
            // selected dither image path (may contain spaces/special chars)
            const selected = imagePaths[i]; // e.g. 'chords dithered/dither_it_f#5.jpg'

            // split directory and filename so we can safely encode the filename portion
            const lastSlash = selected.lastIndexOf('/');
            const dir = lastSlash >= 0 ? selected.slice(0, lastSlash) : '';
            const filename = lastSlash >= 0 ? selected.slice(lastSlash + 1) : selected;

            // Set display <img> src using encoded filename to handle '#' and spaces
            imgEl.src = (dir ? dir + '/' : '') + encodeURIComponent(filename);
            imgEl.alt = 'chord image';

            // Derive chord key from filename: remove prefix and extension
            let chordKey = filename.replace(/^dither_it_/, '').replace(/\.[^.]+$/, '');
            chordKey = decodeURIComponent(chordKey);

            if (paper && chordKey) {
                // Build scribble filename and encode filename only
                const scribbleDir = 'scribbled/scribbled chords';
                const scribbleFilename = `scribbled ${chordKey}.png`;
                const thumb = document.createElement('img');
                thumb.className = 'paper-scribble';
                thumb.src = scribbleDir + '/' + encodeURIComponent(scribbleFilename);
                thumb.alt = `scribbled ${chordKey}`;
                // avoid the browser dragging the image when user tries to draw
                thumb.draggable = false;
                thumb.style.userSelect = 'none';
                thumb.style.webkitUserDrag = 'none';
                // enable drawing when the user starts a pointer gesture on the thumbnail
                thumb.addEventListener('pointerdown', function (ev) {
                    ev.preventDefault();
                    enableDrawingOnImage(thumb, ev);
                });

                // Append or replace in circular history buffer of size `historySize`.
                const existing = paper.querySelectorAll('.paper-scribble');
                if (existing.length < historySize) {
                    paper.appendChild(thumb);
                } else {
                    // replace the element at historyIndex
                    const toReplace = existing[historyIndex];
                    if (toReplace) {
                        toReplace.src = thumb.src;
                        toReplace.alt = thumb.alt;
                    }
                }
                // advance circular index
                historyIndex = (historyIndex + 1) % historySize;
            }
        }

        // Replace an <img> with a canvas and enable drawing (black pen). Optionally begin drawing from startEvent.
        function enableDrawingOnImage(imgEl, startEvent) {
            if (!imgEl || imgEl.tagName !== 'IMG') return;
            const parent = imgEl.parentNode;
            if (!parent) return;

            const imgSrc = imgEl.src;
            const rect = imgEl.getBoundingClientRect();
            const displayWidth = rect.width || 150;
            const displayHeight = rect.height || 150;

            const canvas = document.createElement('canvas');
            canvas.className = (imgEl.className || '') + ' paper-scribble-canvas';
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = displayHeight + 'px';
            canvas.style.display = imgEl.style.display || 'inline-block';
            canvas.style.touchAction = 'none';

            const ctx = canvas.getContext('2d');
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.src = imgSrc;
            image.onload = function () {
                // use natural size for canvas backing; scale CSS to display size
                canvas.width = image.naturalWidth || displayWidth;
                canvas.height = image.naturalHeight || displayHeight;
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                // pick a contrasting stroke color by sampling the center pixel
                let defaultStrokeColor = '#262626ff';
                try {
                    const cx = Math.floor(canvas.width / 2);
                    const cy = Math.floor(canvas.height / 2);
                    const p = ctx.getImageData(cx, cy, 1, 1).data;
                    const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
                    defaultStrokeColor = lum < 128 ? '#ffffff' : '#383838ff';
                } catch (err) {
                    // getImageData can throw if tainted by cross-origin; fall back to black
                    defaultStrokeColor = '#323232ff';
                }

                // store chosen color and a sensible line width on the canvas for later use
                canvas._strokeColor = defaultStrokeColor;
                canvas._lineWidth = Math.max(3, Math.round(canvas.width / 200));

                // after drawing the base image, if a startEvent exists, begin drawing immediately
                if (startEvent) {
                    startPointerDraw(startEvent, canvas, ctx);
                }
            };

            // Replace image with canvas
            parent.replaceChild(canvas, imgEl);

            // Pointer drawing handlers
            function getPos(e) {
                const r = canvas.getBoundingClientRect();
                // adjust for pen hotspot so bottom-left of pen image is used
                let clientX = e.clientX;
                let clientY = e.clientY;
                if (penCursor.loaded) {
                    const dx = (0 - penCursor.hotspotX);
                    const dy = ((penCursor.height - 1) - penCursor.hotspotY);
                    clientX = clientX + dx;
                    clientY = clientY + dy;
                }
                return {
                    x: (clientX - r.left) * (canvas.width / r.width),
                    y: (clientY - r.top) * (canvas.height / r.height)
                };
            }

            let drawing = false;

            function startPointerDraw(e, cv = canvas, context = ctx) {
                e.preventDefault();
                drawing = true;
                try { cv.setPointerCapture(e.pointerId); } catch (err) {}
                const p = getPos(e);
                context.lineJoin = 'round';
                context.lineCap = 'round';
                // use stored contrasting color if available
                context.strokeStyle = (cv._strokeColor) ? cv._strokeColor : '#000000';
                context.lineWidth = (cv._lineWidth) ? cv._lineWidth : Math.max(3, Math.round(cv.width / 200));
                context.beginPath();
                context.moveTo(p.x, p.y);
            }

            function movePointerDraw(e) {
                if (!drawing) return;
                const p = getPos(e);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }

            function endPointerDraw(e) {
                if (!drawing) return;
                drawing = false;
                try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
            }

            canvas.addEventListener('pointerdown', startPointerDraw);
            canvas.addEventListener('pointermove', movePointerDraw);
            canvas.addEventListener('pointerup', endPointerDraw);
            canvas.addEventListener('pointercancel', endPointerDraw);

            // double-click resets to base image only
            canvas.addEventListener('dblclick', function () {
                const img2 = new Image(); img2.crossOrigin = 'anonymous'; img2.src = imgSrc;
                img2.onload = function () { ctx.drawImage(img2, 0, 0, canvas.width, canvas.height); };
            });
        }

        // Helper: set scribble image size in pixels while keeping aspect ratio
        function setScribbleSizePx(selector, px) {
            const el = document.querySelector(selector);
            if (!el) return false;
            el.style.width = px + 'px';
            el.style.height = 'auto'; // preserve ratio
            return true;
        }

        // Helper: set scribble image size in percentage (relative to offsetParent) while preserving ratio
        function setScribbleSizePercent(selector, percent) {
            const el = document.querySelector(selector);
            if (!el) return false;
            el.style.width = percent + '%';
            el.style.height = 'auto';
            return true;
        }

        // ----------------------
        // Video / pedal behavior
        // Keep existing pedal behavior if a video element exists; do NOT block audio controls
        // ----------------------
        const hasVideo = !!video;
        if (hasVideo) {
            try { video.pause(); } catch(e) {}

            const previewDuration = 1500; // milliseconds
            let isGenerating = false;
            let genTimeout = null;

            btn.addEventListener('click', function () {
                // If already in generation sequence, ignore repeated clicks
                if (isGenerating) return;

                if (video.paused) {
                    isGenerating = true;
                    try { video.currentTime = 0; } catch(e) {}
                    video.play().then(() => {
                        btn.classList.add('playing');
                        if (led) led.style.backgroundColor = 'red';

                        genTimeout = setTimeout(() => {
                            video.pause();
                            showRandomImage();
                            isGenerating = false;
                            genTimeout = null;
                        }, previewDuration);
                    }).catch(err => {
                        console.warn('Video play failed:', err);
                        showRandomImage();
                        isGenerating = false;
                    });
                } else {
                    if (genTimeout) { clearTimeout(genTimeout); genTimeout = null; }
                    video.pause();
                    isGenerating = false;
                    btn.classList.remove('playing');
                    if (led) led.style.backgroundColor = 'grey';
                }
            });

            video.addEventListener('play', function () {
                btn.classList.add('playing');
                if (led) led.style.backgroundColor = 'red';
            });

            video.addEventListener('pause', function () {
                btn.classList.remove('playing');
                if (led) led.style.backgroundColor = 'grey';
            });

            video.addEventListener('ended', function () {
                btn.classList.remove('playing');
                if (led) led.style.backgroundColor = 'grey';
                try { video.currentTime = 0; } catch(e) {}
                try { video.pause(); } catch(e) {}
            });
        }

        // ----------------------
        // Audio play/stop (separate from pedal/video)
        // Uses And-I-Love-Her.mp3 and the image buttons (#playbutton, #stopbutton)
        // ----------------------
        const playImg = document.getElementById('playbutton');
        const stopImg = document.getElementById('stopbutton');
        const audio = new Audio('And-I-Love-Her.mp3');
        audio.preload = 'auto';

        // initialize UI: show play, hide stop (if elements exist)
        if (playImg) playImg.style.display = '';
        if (stopImg) stopImg.style.display = 'none';

        function updateAudioUi(isPlaying) {
            if (isPlaying) {
                if (playImg) playImg.style.display = 'none';
                if (stopImg) stopImg.style.display = '';
            } else {
                if (playImg) playImg.style.display = '';
                if (stopImg) stopImg.style.display = 'none';
            }
            if (led) led.style.backgroundColor = isPlaying ? 'red' : 'grey';
        }

        function startAudio() {
            try { audio.currentTime = 0; } catch(e) {}
            audio.play().then(() => updateAudioUi(true)).catch(err => console.warn('Audio play failed:', err));
        }

        function stopAudio() {
            audio.pause();
            try { audio.currentTime = 0; } catch(e) {}
            updateAudioUi(false);
        }

        if (playImg) playImg.addEventListener('click', function (e) { e.stopPropagation(); startAudio(); });
        if (stopImg) stopImg.addEventListener('click', function (e) { e.stopPropagation(); stopAudio(); });

        // Clicking the pedal's main `#button` should NOT control audio; keep behaviors separate
        // But for convenience, allow the pedal button to toggle audio only if user holds Alt (optional)
        if (btn) btn.addEventListener('click', function (e) {
            if (e.altKey) {
                if (audio.paused) startAudio(); else stopAudio();
            }
        });

        audio.addEventListener('ended', function () { updateAudioUi(false); });

    })();

    // Draggable window functionality for #kurtvid-container
    (function() {
        const videoContainer = document.getElementById('kurtvid-container');
        const titlebar = document.querySelector('.kurtvid-titlebar');
        const minimizeBtn = document.getElementById('kurtvid-minimize-btn');
        const kurtvid = document.getElementById('kurtvid');
        
        if (!videoContainer || !titlebar) return;

        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        // Start dragging from titlebar
        titlebar.addEventListener('mousedown', function(e) {
            // Don't start drag if clicking the minimize button
            if (e.target === minimizeBtn) return;
            
            isDragging = true;
            const rect = videoContainer.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            titlebar.style.cursor = "url('images/hand%20select.png') 16 16, grabbing";
            
            // Disable iframe pointer events during drag
            if (kurtvid) kurtvid.classList.add('dragging');
        });

        // Drag movement
        document.addEventListener('mousemove', function(e) {
            if (isDragging) {
                let x = e.clientX - offsetX;
                let y = e.clientY - offsetY;

                // Keep container within viewport bounds
                x = Math.max(0, Math.min(x, window.innerWidth - videoContainer.offsetWidth));
                y = Math.max(0, Math.min(y, window.innerHeight - videoContainer.offsetHeight));

                videoContainer.style.left = x + 'px';
                videoContainer.style.top = y + 'px';
            }
        });

        // Stop dragging
        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                titlebar.style.cursor = "url('images/hand%20cursor.png') 16 16";
                // Re-enable iframe pointer events
                if (kurtvid) kurtvid.classList.remove('dragging');
            }
        });

        // Minimize/Restore functionality
        minimizeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            videoContainer.classList.toggle('minimized');
            minimizeBtn.textContent = videoContainer.classList.contains('minimized') ? '□' : '−';
        });

        // Prevent text selection while dragging
        titlebar.addEventListener('selectstart', function(e) {
            if (isDragging) e.preventDefault();
        });
    })();
