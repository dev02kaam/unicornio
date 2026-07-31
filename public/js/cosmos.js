(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const isLoginPage = window.location.pathname === '/login.html';

  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element && element.textContent !== text) element.textContent = text;
  }

  function applyStudentVoice() {
    if (document.documentElement.dataset.userRole !== 'STUDENT') return;

    const path = window.location.pathname;

    if (path === '/groups.html') {
      document.title = 'Mi grupo | Proyecto Unicornio';
      setText('.org-hero .hero-copy > .badge', 'Tu clase');
      setText('.org-hero .hero-copy > h1', 'Mi grupo');
      setText('.org-hero .hero-copy > p', 'Aquí puedes ver tu clase y las personas que te acompañan en el cole.');
      setText('.org-panel .section-header h2', 'Encuentra tu grupo');
      setText('.org-panel .section-header p', 'Busca por nombre si quieres llegar más rápido.');
    }

    if (path === '/consents.html') {
      document.title = 'Mis permisos | Proyecto Unicornio';
      setText('.dashboard-hero .hero-copy > .badge', 'Tu participación');
      setText('.dashboard-hero .hero-copy > h1', 'Mis permisos');
      setText('.dashboard-hero .hero-copy > p', 'Mira qué permisos están listos y cuáles esperan una respuesta de tu familia.');
      setText('.consent-notice-card .badge', 'Lo que necesitas saber');
      setText('.consent-list-card .section-header h2', 'Tus permisos, uno a uno');
      setText('.consent-list-card .section-header .badge', 'Tu lista');

      const cards = document.querySelectorAll('.consent-summary-grid > .dashboard-quickcard');
      const labels = [
        ['Esperando respuesta', 'Tu familia todavía tiene que revisar estas solicitudes.'],
        ['Todo listo', 'Permisos que ya están preparados.'],
        ['Otros', 'Permisos que cambiaron o ya no están activos.'],
      ];
      cards.forEach((card, index) => {
        if (!labels[index]) return;
        const label = card.querySelector('.quickcard-label');
        const copy = card.querySelector('.quickcard-email');
        if (label) label.textContent = labels[index][0];
        if (copy) copy.textContent = labels[index][1];
      });
    }
  }

  function installRoleMode() {
    if (window.location.pathname === '/login.html') return;
    const tokenRole = typeof getTokenRole === 'function' ? getTokenRole() : null;
    if (tokenRole) document.documentElement.dataset.userRole = String(tokenRole).toUpperCase();
    applyStudentVoice();

    const roleObserver = new MutationObserver(() => {
      applyStudentVoice();
    });
    roleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-user-role'],
    });

    document.addEventListener('unicornio:request-end', () => {
      window.setTimeout(applyStudentVoice, 0);
    });
  }

  function installConstellation() {
    const canvas = document.createElement('canvas');
    canvas.className = 'constellation-field';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const context = canvas.getContext('2d');
    if (!context) {
      canvas.remove();
      return;
    }

    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let points = [];
    let lastTime = 0;
    const pointer = { x: -1000, y: -1000, active: false };

    function pointCount() {
      if (width < 600) return 15;
      if (width < 1050) return 26;
      return Math.min(58, Math.max(38, Math.round(width / 30)));
    }

    function buildPoints() {
      const count = pointCount();
      const contentWidth = Math.min(1180, Math.max(0, width - 36));
      const gutter = Math.max(0, (width - contentWidth) / 2);
      const useGutters = gutter >= 72;

      points = Array.from({ length: count }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        let x;
        let y;

        if (useGutters) {
          const inner = 14 + Math.random() * Math.max(18, gutter - 28);
          x = side < 0 ? inner : width - inner;
          y = 24 + Math.random() * Math.max(40, height - 48);
        } else {
          x = 14 + Math.random() * Math.max(20, width - 28);
          y = index % 3 === 0
            ? 12 + Math.random() * 92
            : height - 82 + Math.random() * 70;
        }

        return {
          x,
          y,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
          side: useGutters ? side : Math.sign(x - width / 2),
          radius: index % 8 === 0 ? 3.2 : index % 3 === 0 ? 2 : 1.25,
          phase: Math.random() * Math.PI * 2,
          speed: 0.22 + Math.random() * 0.42,
          color: index % 9 === 0 ? 'pink' : index % 5 === 0 ? 'mint' : 'blue',
          star: index % 7 === 0,
        };
      });
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      buildPoints();
      draw(performance.now());
    }

    function drawStar(point, alpha) {
      const size = point.radius * 2.6;
      context.save();
      context.translate(point.x, point.y);
      context.rotate(Math.PI / 4);
      context.beginPath();
      context.moveTo(0, -size);
      context.lineTo(size * 0.22, -size * 0.22);
      context.lineTo(size, 0);
      context.lineTo(size * 0.22, size * 0.22);
      context.lineTo(0, size);
      context.lineTo(-size * 0.22, size * 0.22);
      context.lineTo(-size, 0);
      context.lineTo(-size * 0.22, -size * 0.22);
      context.closePath();
      context.fillStyle = `rgba(73, 80, 198, ${alpha})`;
      context.fill();
      context.restore();
    }

    function pointFill(point, alpha) {
      if (point.color === 'pink') return `rgba(239, 91, 157, ${alpha})`;
      if (point.color === 'mint') return `rgba(43, 157, 142, ${alpha})`;
      return `rgba(20, 97, 225, ${alpha})`;
    }

    function draw(time) {
      context.clearRect(0, 0, width, height);
      const isStudent = document.documentElement.dataset.userRole === 'STUDENT';
      const baseAlpha = isLoginPage ? 0.62 : isStudent ? 0.5 : 0.34;
      const connectionDistance = width > 1100 ? 156 : 126;

      points.forEach((point, index) => {
        for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
          const next = points[nextIndex];
          if (point.side !== next.side) continue;
          const dx = next.x - point.x;
          const dy = next.y - point.y;
          const distance = Math.hypot(dx, dy);
          if (distance >= connectionDistance) continue;

          const connectionAlpha = isLoginPage ? 0.28 : isStudent ? 0.23 : 0.14;
          const alpha = (1 - distance / connectionDistance) * connectionAlpha;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(next.x, next.y);
          context.strokeStyle = `rgba(45, 72, 190, ${alpha})`;
          context.lineWidth = 0.85;
          context.stroke();
        }
      });

      points.forEach((point) => {
        const shimmer = 0.82 + Math.sin(time * 0.0014 + point.phase) * 0.18;
        const alpha = baseAlpha * shimmer;
        if (point.star) {
          drawStar(point, alpha);
          return;
        }
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fillStyle = pointFill(point, alpha);
        context.fill();
      });
    }

    function animate(time) {
      const delta = Math.min(32, time - lastTime || 16.7) / 16.7;
      lastTime = time;

      points.forEach((point) => {
        const ambientX = Math.sin(time * 0.00024 * point.speed + point.phase) * 5;
        const ambientY = Math.cos(time * 0.0002 * point.speed + point.phase) * 7;
        const targetX = point.baseX + ambientX;
        const targetY = point.baseY + ambientY;
        point.vx += (targetX - point.x) * 0.018 * delta;
        point.vy += (targetY - point.y) * 0.018 * delta;

        if (pointer.active) {
          const dx = point.x - pointer.x;
          const dy = point.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const radius = 175;
          if (distance > 0 && distance < radius) {
            const force = (1 - distance / radius) * 0.72 * delta;
            point.vx += (dx / distance) * force;
            point.vy += (dy / distance) * force;
          }
        }

        point.vx *= 0.9;
        point.vy *= 0.9;
        point.x += point.vx * delta;
        point.y += point.vy * delta;
      });

      draw(time);
      frame = window.requestAnimationFrame(animate);
    }

    function start() {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches) {
        draw(performance.now());
        return;
      }
      lastTime = performance.now();
      frame = window.requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize, { passive: true });
    if (finePointer.matches && !reducedMotion.matches) {
      window.addEventListener('pointermove', (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => {
        pointer.active = false;
      });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
      } else {
        start();
      }
    });
    reducedMotion.addEventListener?.('change', start);

    resize();
    start();
  }

  installRoleMode();
  installConstellation();
})();
