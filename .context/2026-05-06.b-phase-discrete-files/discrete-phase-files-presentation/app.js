/* === Sidebar Navigation === */
document.addEventListener('DOMContentLoaded', () => {
  // Active section highlighting
  const sections = document.querySelectorAll('.section');
  const navLinks = document.querySelectorAll('.sidebar-nav-item');

  const observerOptions = {
    root: null,
    rootMargin: '-80px 0px -60% 0px',
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((link) => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach((section) => {
    if (section.id) observer.observe(section);
  });

  // Mobile sidebar toggle
  const toggleBtn = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      const isOpen = sidebar.classList.contains('open');
      toggleBtn.textContent = isOpen ? '✕ Close' : '☰ Menu';
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('open');
        if (toggleBtn) toggleBtn.textContent = '☰ Menu';
      }
    });

    // Close on nav click (mobile)
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          if (toggleBtn) toggleBtn.textContent = '☰ Menu';
        }
      });
    });
  }

  // Expandable details
  const detailBlocks = document.querySelectorAll('.details-block');
  detailBlocks.forEach((block) => {
    const summary = block.querySelector('.details-summary');
    if (summary) {
      summary.addEventListener('click', (e) => {
        e.preventDefault();
        if (block.hasAttribute('open')) {
          block.removeAttribute('open');
        } else {
          block.setAttribute('open', '');
        }
      });
    }
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, null, anchor.getAttribute('href'));
      }
    });
  });
});
