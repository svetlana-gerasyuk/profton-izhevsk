/* Проф Тон – заявка на запись: несколько услуг, день, желаемое время, контакты, живой текст заявки (30.10.2026).
   Даты и время – по Ижевску (Europe/Samara, UTC+4), прошедшие не выбрать. Ничего не отправляет само:
   копирует заявку, звонит по tel: или копирует текст и открывает сообщения сообщества во ВКонтакте.
   Плюс кнопки «Добавить в заявку» на карточках услуг и просмотр фото работ. */
(() => {
  const form = document.querySelector("[data-b-booking]");
  if (!form) return;

  const VK = "https://vk.me/profton18";    // сообщество ВК с карточки на Яндекс.Картах
  const TZ = "Europe/Samara";
  // желаемое время по графику: пн–пт 09:30–20:00, сб–вс 10:00–18:00 (последний час – за час до закрытия)
  const SLOTS_WEEK = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
  const SLOTS_END = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const slotsFor = (wdNum) => (wdNum === 0 || wdNum === 6 ? SLOTS_END : SLOTS_WEEK);
  const DAYS = 14, LEAD_MIN = 60;           // окно записи – 2 недели, ближайшее время – не раньше чем через час
  const KEY = "profton-zayavka";

  const $ = (s, r = form) => r.querySelector(s);
  const $$ = (s, r = form) => [...r.querySelectorAll(s)];
  const daysBox = $("[data-b-days]"), timesBox = $("[data-b-times]"), timesNote = $("[data-b-times-note]");
  const textEl = $("[data-b-text]"), errEl = $("[data-b-error]"), noteEl = $("[data-b-note]");

  // ---- «сейчас» в Ижевске, независимо от часового пояса посетителя
  const izhNow = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, min: +p.hour * 60 + +p.minute };
  };
  const wd = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const wdFull = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const mon = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const monShort = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  // ---- черновик: если посетитель перезагрузил страницу, введённое не теряется
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } };
  const save = (st) => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };
  const draft = load();

  // ---- дни
  let today = izhNow();
  const buildDays = (keep) => {
    today = izhNow();
    daysBox.innerHTML = "";
    const base = new Date(Date.UTC(today.y, today.m - 1, today.d));
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(base); d.setUTCDate(base.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10), w = d.getUTCDay();
      const full = (i === 0 ? "сегодня, " : i === 1 ? "завтра, " : "") + d.getUTCDate() + " " + mon[d.getUTCMonth()] + ", " + wdFull[w];
      const top = i === 0 ? "сегодня" : i === 1 ? "завтра" : wd[w];
      const slots = slotsFor(w);
      const off = i === 0 && today.min + LEAD_MIN > toMin(slots[slots.length - 1]);
      daysBox.insertAdjacentHTML("beforeend",
        `<label class="b-day${i === 0 ? " is-today" : ""}"><input type="radio" name="day" value="${iso}" data-wd="${w}" data-full="${full}"${off ? " disabled" : ""}><span><small><i>${top}</i><i>${wd[w]}</i></small><b>${d.getUTCDate()}</b><em>${monShort[d.getUTCMonth()]}</em></span></label>`);
    }
    const pick = keep && daysBox.querySelector(`input[value="${keep}"]:not(:disabled)`) || daysBox.querySelector("input:not(:disabled)");
    if (pick) pick.checked = true;
  };

  // ---- время для выбранного дня; выбранное время сохраняется, если оно ещё доступно
  const buildTimes = (keep) => {
    const day = daysBox.querySelector("input:checked");
    const isToday = day && day === daysBox.querySelector("input");
    timesBox.innerHTML = "";
    slotsFor(day ? +day.dataset.wd : 1).forEach((t) => {
      const past = isToday && toMin(t) < izhNow().min + LEAD_MIN;
      timesBox.insertAdjacentHTML("beforeend", `<label class="b-time"><input type="radio" name="time" value="${t}"${past ? " disabled" : ""}><span>${t}</span></label>`);
    });
    timesNote.hidden = true;
    if (keep) {
      const inp = timesBox.querySelector(`input[value="${keep}"]`);
      if (inp && !inp.disabled) inp.checked = true;
      else { timesNote.textContent = `На этот день ${keep} недоступно – выберите другое время.`; timesNote.hidden = false; }
    }
  };

  // ---- текст заявки
  const services = () => $$("input[name=svc]:checked").map((i) => i.value);
  const val = (n) => (form.elements[n].value || "").trim();
  const phoneOk = () => val("phone").replace(/\D/g, "").length >= 10;
  const buildText = () => {
    const list = services(), day = daysBox.querySelector("input:checked"), time = timesBox.querySelector("input:checked");
    const lines = ["Здравствуйте! Хочу записаться в автостудию «Проф Тон».", "", list.length > 1 ? "Интересуют услуги:" : "Интересует услуга:"];
    if (list.length) list.forEach((s) => lines.push("— " + s + "."));
    else lines.push("— пока не выбрал(а).");
    lines.push("", "Желаемая дата: " + (day ? day.dataset.full : "не выбрана"), "Желаемое время: " + (time ? time.value : "не выбрано"));
    lines.push("Марка и модель автомобиля: " + (val("car") || "–"));
    if (val("year")) lines.push("Год выпуска: " + val("year"));
    lines.push("Имя: " + (val("name") || "–"), "Телефон: " + (val("phone") || "–"));
    if (val("comment")) lines.push("Комментарий: " + val("comment"));
    lines.push("", "Подскажите, пожалуйста, возможность записи и предварительную стоимость.");
    return lines.join("\n");
  };

  const markSteps = () => {
    const done = { svc: services().length > 0, day: !!daysBox.querySelector("input:checked"), time: !!timesBox.querySelector("input:checked"), contacts: !!(val("name") && phoneOk() && val("car")) };
    $$("[data-b-step]").forEach((f) => f.classList.toggle("is-done", !!done[f.dataset.bStep]));
  };

  const update = () => {
    $("[data-b-count]").textContent = services().length;
    textEl.textContent = buildText();
    markSteps();
    save({ svc: services(), day: daysBox.querySelector("input:checked")?.value, time: timesBox.querySelector("input:checked")?.value,
      name: val("name"), phone: val("phone"), car: val("car"), year: val("year"), comment: val("comment") });
    if (!errEl.hidden) check(false);
  };

  // ---- проверка обязательного
  const check = (focus = true) => {
    const miss = []; let first = null;
    const need = (ok, label, el) => { if (!ok) { miss.push(label); first = first || el; } };
    need(services().length > 0, "услугу", $("input[name=svc]"));
    need(!!daysBox.querySelector("input:checked"), "день", daysBox.querySelector("input:not(:disabled)"));
    need(!!timesBox.querySelector("input:checked"), "время", timesBox.querySelector("input:not(:disabled)"));
    need(!!val("name"), "имя", form.elements.name);
    need(phoneOk(), "телефон", form.elements.phone);
    need(!!val("car"), "марку и модель", form.elements.car);
    const bad = { name: !val("name"), phone: !phoneOk(), car: !val("car") };
    Object.entries(bad).forEach(([n, b]) => form.elements[n].closest(".b-field").classList.toggle("is-bad", b && miss.length > 0));
    if (miss.length) {
      errEl.textContent = "Чтобы собрать заявку, укажите: " + miss.join(", ") + ".";
      errEl.hidden = false;
      if (focus && first) first.focus({ preventScroll: false });
      return false;
    }
    errEl.hidden = true;
    return true;
  };

  const say = (t) => { noteEl.textContent = t; noteEl.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => (noteEl.hidden = true), 7000); };
  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (_) {
      const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok;
    }
  };

  form.addEventListener("click", async (e) => {
    const cp = e.target.closest("[data-b-copy]"), vk = e.target.closest("[data-b-vk]"), call = e.target.closest("[data-b-call]");
    if (call) { say("Звоним в автостудию. Назовите услуги, день и машину – текст заявки перед глазами."); return; }   // tel: работает сам
    if (!cp && !vk) return;
    e.preventDefault();
    if (!check()) return;
    const text = buildText();
    $(".b-preview").open = true;
    if (cp) { say(await copy(text) ? "Заявка скопирована – вставьте её в сообщение или прочитайте по телефону." : "Не получилось скопировать – выделите текст заявки выше вручную."); return; }
    const ok = await copy(text);
    window.open(VK, "_blank", "noopener");
    say(ok ? "Заявка скопирована. Вставьте её в открывшийся чат сообщества ВКонтакте и отправьте." : "Откройте чат ВКонтакте и вставьте заявку из блока «Текст заявки».");
  });

  // ---- события: смена услуг не трогает день, время и контакты
  daysBox.addEventListener("change", () => { const t = timesBox.querySelector("input:checked")?.value; buildTimes(t); update(); });
  form.addEventListener("change", (e) => { if (!e.target.closest("[data-b-days]")) update(); });
  form.addEventListener("input", (e) => { if (e.target.matches("input[type=text], input[type=tel], textarea")) update(); });
  form.elements.year.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });

  const toForm = (focusSel) => {
    document.getElementById("widget").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setTimeout(() => $(focusSel).focus({ preventScroll: true }), 450);
  };

  document.addEventListener("click", (e) => {
    // кнопки «Записаться» по странице: прокрутка к форме
    const go = e.target.closest("[data-b-go]");
    if (go) { e.preventDefault(); toForm("input[name=svc]"); return; }
    // «Добавить в заявку» на карточке услуги: отмечает услугу, остальной выбор не трогает
    const pick = e.target.closest("[data-b-pick]");
    if (pick) {
      const inp = $$("input[name=svc]").find((i) => i.value === pick.dataset.bPick);
      if (!inp) return;
      inp.checked = true; update(); syncPicks();
      toForm(`input[value="${inp.value}"]`);
    }
  });
  const syncPicks = () => document.querySelectorAll("[data-b-pick]").forEach((b) => {
    const on = services().includes(b.dataset.bPick);
    b.classList.toggle("is-on", on); b.textContent = on ? "В заявке ✓" : "Добавить в заявку";
  });
  form.addEventListener("change", syncPicks);

  // ---- старт: черновик или значения по умолчанию
  if (draft) {
    if (Array.isArray(draft.svc)) $$("input[name=svc]").forEach((i) => (i.checked = draft.svc.includes(i.value)));
    ["name", "phone", "car", "year", "comment"].forEach((n) => { if (draft[n]) form.elements[n].value = draft[n]; });
  } else $("input[name=svc]").checked = true;
  buildDays(draft && draft.day);
  buildTimes(draft && draft.time);
  update(); syncPicks();

  // страница открыта долго: раз в минуту закрываем прошедшее время, выбор не сбрасываем без нужды
  setInterval(() => {
    const now = izhNow();
    const dayChanged = now.d !== today.d, onToday = daysBox.querySelector("input:checked") === daysBox.querySelector("input");
    if (!dayChanged && !onToday) return;
    const d = daysBox.querySelector("input:checked")?.value, t = timesBox.querySelector("input:checked")?.value;
    buildDays(d); buildTimes(t); update();
  }, 60000);

  // ---- фото работ: просмотр крупно, стрелки и Esc
  const dlg = document.querySelector("[data-b-lb-dialog]");
  const shots = [...document.querySelectorAll("[data-b-lb]")];
  if (dlg && shots.length) {
    const img = dlg.querySelector("[data-b-lb-img]"), cap = dlg.querySelector("[data-b-lb-cap]");
    let cur = 0;
    const show = (i) => {
      cur = (i + shots.length) % shots.length;
      const src = shots[cur].querySelector("img");
      img.src = src.currentSrc || src.src; img.alt = src.alt; cap.textContent = `${src.alt} · ${cur + 1} из ${shots.length}`;
    };
    shots.forEach((b, i) => b.addEventListener("click", () => { show(i); dlg.showModal(); }));
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-b-lb-close]") || e.target === dlg) { dlg.close(); return; }
      const st = e.target.closest("[data-b-lb-step]"); if (st) show(cur + +st.dataset.bLbStep);
    });
    dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") show(cur + 1); if (e.key === "ArrowLeft") show(cur - 1); });
    dlg.addEventListener("close", () => shots[cur].focus({ preventScroll: true }));
  }
})();
