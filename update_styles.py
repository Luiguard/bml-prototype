with open('/home/benjamin/projects/mediclean-pro/omnia-vault/styles.css', 'r') as f:
    lines = f.readlines()

# keep up to line 657
lines = lines[:657]

new_css = """
/* ================= ULTRA PREMIUM LANDING PAGE ================= */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Inter:wght@300;400;500&display=swap');

.premium-body {
    background-color: #050505;
    color: #ffffff;
    font-family: 'Inter', sans-serif;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
}

.premium-bg {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background-image: url('https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2000&auto=format&fit=crop');
    background-size: cover;
    background-position: center;
    opacity: 0.15;
    z-index: 0;
    pointer-events: none;
    filter: grayscale(80%) contrast(1.2);
}

.vignette {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: radial-gradient(circle, transparent 20%, #050505 90%);
    z-index: 1;
    pointer-events: none;
}

.premium-nav {
    position: relative;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2.5rem 5%;
}

.nav-logo {
    font-family: 'Cinzel', serif;
    font-size: 1.8rem;
    letter-spacing: 6px;
    color: #fff;
}

.nav-login {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #fff;
    text-decoration: none;
    border-bottom: 1px solid rgba(255,255,255,0.3);
    padding-bottom: 4px;
    transition: 0.3s;
}

.nav-login:hover {
    border-color: #D4AF37;
    color: #D4AF37;
}

.premium-hero {
    position: relative;
    z-index: 10;
    height: 85vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
}

.hero-eyebrow {
    font-family: 'Inter', sans-serif;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 4px;
    color: #D4AF37;
    margin-bottom: 2rem;
    font-weight: 400;
}

.hero-title {
    font-family: 'Cinzel', serif;
    font-size: 7rem;
    font-weight: 500;
    letter-spacing: 20px;
    margin: 0 0 2rem 0;
    text-shadow: 0 10px 30px rgba(0,0,0,0.5);
    background: linear-gradient(to bottom, #fff 40%, #888);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.hero-desc {
    max-width: 600px;
    margin: 0 auto 3rem auto;
    font-size: 1.1rem;
    line-height: 1.8;
    color: rgba(255,255,255,0.7);
    font-weight: 300;
}

.btn-gold-outline {
    display: inline-block;
    padding: 16px 40px;
    border: 1px solid #D4AF37;
    color: #D4AF37;
    text-decoration: none;
    text-transform: uppercase;
    letter-spacing: 3px;
    font-size: 0.85rem;
    transition: all 0.4s ease;
    background: rgba(212, 175, 55, 0.05);
}

.btn-gold-outline:hover {
    background: #D4AF37;
    color: #050505;
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(212, 175, 55, 0.2);
}

.scroll-down {
    position: absolute;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.scroll-down span {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 4px;
    color: rgba(255,255,255,0.5);
}

.scroll-down .line {
    width: 1px;
    height: 60px;
    background: linear-gradient(to bottom, rgba(255,255,255,0.5), transparent);
}

.premium-story {
    position: relative;
    z-index: 10;
    padding: 5rem 5% 10rem 5%;
    background: #050505;
}

.story-block {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto 10rem auto;
    gap: 5rem;
    opacity: 0;
    transform: translateY(40px);
    transition: all 1s ease-out;
}

.story-block.visible {
    opacity: 1;
    transform: translateY(0);
}

.story-block.reverse {
    flex-direction: row-reverse;
}

.story-text {
    flex: 1;
}

.story-number {
    font-family: 'Cinzel', serif;
    font-size: 3rem;
    color: rgba(212, 175, 55, 0.2);
    margin-bottom: 1rem;
}

.story-text h3 {
    font-family: 'Cinzel', serif;
    font-size: 2.5rem;
    margin-bottom: 1.5rem;
    color: #fff;
    font-weight: 400;
}

.story-text p {
    font-size: 1.05rem;
    line-height: 1.8;
    color: rgba(255,255,255,0.6);
    font-weight: 300;
}

.story-visual {
    flex: 1;
    height: 500px;
    overflow: hidden;
}

.story-visual img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(30%);
    transition: transform 1.5s ease;
}

.story-block:hover .story-visual img {
    transform: scale(1.05);
    filter: grayscale(0%);
}

.premium-footer {
    position: relative;
    z-index: 10;
    background: #050505;
    padding: 5rem 0;
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.05);
}

.premium-footer h2 {
    font-family: 'Cinzel', serif;
    font-size: 2rem;
    letter-spacing: 8px;
    color: #fff;
    margin-bottom: 1rem;
}

.premium-footer p {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 4px;
    color: rgba(255,255,255,0.4);
}

/* Animations */
.fade-in-up {
    opacity: 0;
    transform: translateY(30px);
    transition: all 1s ease-out;
}

.fade-in-up.visible {
    opacity: 1;
    transform: translateY(0);
}

.delay-1 { transition-delay: 0.3s; }
.delay-2 { transition-delay: 0.6s; }

"""

lines.append(new_css)
with open('/home/benjamin/projects/mediclean-pro/omnia-vault/styles.css', 'w') as f:
    f.writelines(lines)
