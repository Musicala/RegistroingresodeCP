'use strict';

/* =============================================================================
  CP (Clase de prueba) — Script exclusivo
  - Lista SI o SI desde Apps Script (action=meta)
  - Combo con filtro: escribes y eliges (no permite texto libre)
  - Envía: guardarPago con Servicio fijo "Musicala Cortesía CP"
============================================================================= */

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwOdMJ-aiPfDVHNT3u3v6YhnSB77m51adPzFlbA7_lqvTQGc79-RisbHBVdWGM4m_nc/exec";

// Servicio fijo
const CP_SERVICE = "Musicala Cortesía CP";
const CP_COMMENT = "Clase de prueba (CP)";

let META = { estudiantes: [], mediosPago: [], tiposEstudiante: [] };
let STUDENTS = [];              // lista original
let STUDENT_SET = new Set();    // validación exacta
let activeIndex = -1;

const $ = (id) => document.getElementById(id);

function setStatus(txt){ const el = $("status"); if (el) el.textContent = txt; }

let toastTimer = null;
function toast(msg){
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove("show"), 2200);
}

// JSONP helper (Apps Script sin CORS)
function jsonp(url, timeoutMs = 14000){
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout cargando META."));
    }, timeoutMs);

    function cleanup(){
      clearTimeout(timer);
      try { delete window[cb]; } catch(e){ window[cb] = undefined; }
      script.remove();
    }

    window[cb] = (data) => { cleanup(); resolve(data); };

    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb + "&_=" + Date.now();
    script.onerror = () => { cleanup(); reject(new Error("No se pudo cargar META.")); };
    document.head.appendChild(script);
  });
}

function pickByKeywords(list, keywords){
  const arr = (list || []).map(String);
  const lower = arr.map(s => s.toLowerCase());
  for (const k of keywords){
    const kk = String(k).toLowerCase();
    const idx = lower.findIndex(s => s.includes(kk));
    if (idx >= 0) return arr[idx];
  }
  return "";
}

async function loadMeta(){
  setStatus("Cargando listas...");
  const resp = await jsonp(`${WEBAPP_URL}?action=meta`);
  if (!resp || !resp.ok) throw new Error(resp?.error || "Meta inválida");

  META = resp.meta || META;

  STUDENTS = (META.estudiantes || [])
    .map(s => String(s).trim())
    .filter(Boolean);

  STUDENT_SET = new Set(STUDENTS.map(s => s.toLowerCase()));

  // tipo estudiante default
  const defaultTipo =
    pickByKeywords(META.tiposEstudiante, ["antigu", "conven", "regular", "nuevo"]) ||
    (META.tiposEstudiante?.[0] || "General");
  $("tipoEstudiante").value = defaultTipo;

  // medio pago default (ideal: Cortesía/Prueba/CP)
  const mp =
    pickByKeywords(META.mediosPago, ["cortes", "prueb", "cp", "cortesia"]) ||
    (META.mediosPago?.[0] || "Cortesía");
  $("medioPago").value = mp;

  // habilita UI
  $("btnGuardar").disabled = false;
  $("btnNuevo").disabled = false;

  setStatus(`Listo. (${STUDENTS.length} estudiantes) ✅`);
}

function buildDatos(){
  const fechaPago = $("fechaPago").value;
  const estudiante = ($("estudiante").value || "").trim();

  return {
    fechaPago,
    tipoEstudiante: $("tipoEstudiante").value || "General",

    // usamos no registrado, pero VALIDADO contra lista
    usuario1: "",
    usuarioNoRegistrado: estudiante,

    // Servicio fijo
    servicio1: CP_SERVICE,
    precioServicio1: "0",
    ciclo1: "CP",

    // vacíos
    servicio2: "", precioServicio2: "", ciclo2: "",
    servicio3: "", precioServicio3: "", ciclo3: "",

    medioPago: $("medioPago").value || "Cortesía",
    recargo: "",
    descuento: "",
    FEVM: "",
    comentario: CP_COMMENT
  };
}

function validate(datos){
  if (!datos.fechaPago) return "Falta la fecha.";
  if (!datos.usuarioNoRegistrado) return "Selecciona un estudiante.";

  if (!STUDENT_SET || !STUDENT_SET.size) return "No tengo la lista cargada todavía.";

  const key = datos.usuarioNoRegistrado.toLowerCase();
  if (!STUDENT_SET.has(key)) return "Ese nombre no está en la lista. Selecciónalo del filtro.";

  if (!String(datos.medioPago || "").trim()) return "Falta medio de pago (interno).";
  return "";
}

async function submit(datos){
  const payload = { action: "guardarPago", datos };
  await fetch(WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

// =========================
// Combo estudiantes (filtro + selección obligatoria)
// =========================
function renderList(items){
  const box = $("studentList");
  box.innerHTML = "";
  activeIndex = -1;

  if (!items.length){
    const div = document.createElement("div");
    div.className = "comboItem";
    div.textContent = "Sin resultados";
    div.style.opacity = "0.6";
    box.appendChild(div);
    return;
  }

  items.slice(0, 80).forEach((name, idx) => {
    const div = document.createElement("div");
    div.className = "comboItem";
    div.textContent = name;
    div.setAttribute("role", "option");
    div.addEventListener("mousedown", (e) => {
      e.preventDefault(); // evita blur antes de seleccionar
      pickStudent(name);
      hideList();
    });
    box.appendChild(div);
  });
}

function showList(){ $("studentList").classList.add("show"); }
function hideList(){ $("studentList").classList.remove("show"); }

function pickStudent(name){
  $("studentSearch").value = name;
  $("estudiante").value = name; // valor final exacto
}

function clearStudent(){
  $("studentSearch").value = "";
  $("estudiante").value = "";
  renderList(STUDENTS);
}

function filterStudents(q){
  const s = String(q || "").trim().toLowerCase();
  if (!s) return STUDENTS;
  return STUDENTS.filter(n => n.toLowerCase().includes(s));
}

function moveActive(delta){
  const box = $("studentList");
  const items = Array.from(box.querySelectorAll(".comboItem")).filter(x => x.textContent !== "Sin resultados");
  if (!items.length) return;

  activeIndex = Math.max(0, Math.min(items.length - 1, activeIndex + delta));
  items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));

  const el = items[activeIndex];
  el.scrollIntoView({ block: "nearest" });
}

function acceptActive(){
  const box = $("studentList");
  const items = Array.from(box.querySelectorAll(".comboItem")).filter(x => x.textContent !== "Sin resultados");
  if (!items.length) return;
  const el = items[Math.max(0, activeIndex)];
  if (el && el.textContent) {
    pickStudent(el.textContent);
    hideList();
  }
}

function initCombo(){
  const input = $("studentSearch");
  const clearBtn = $("studentClear");

  renderList(STUDENTS);

  input.addEventListener("focus", () => {
    renderList(filterStudents(input.value));
    showList();
  });

  input.addEventListener("input", () => {
    // si el usuario edita, invalida selección previa hasta que seleccione
    $("estudiante").value = "";
    renderList(filterStudents(input.value));
    showList();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); showList(); moveActive(+1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); showList(); moveActive(-1); }
    else if (e.key === "Enter") { 
      if ($("studentList").classList.contains("show")) {
        e.preventDefault();
        acceptActive();
      }
    }
    else if (e.key === "Escape") { hideList(); }
  });

  input.addEventListener("blur", () => {
    // deja tiempo a mousedown de seleccionar
    setTimeout(() => {
      hideList();
      // si no seleccionó exacto, no lo dejamos pasar
      const typed = String(input.value || "").trim();
      if (!typed) {
        $("estudiante").value = "";
        return;
      }
      if (STUDENT_SET.has(typed.toLowerCase())) {
        // si escribió exactamente igual, lo aceptamos
        $("estudiante").value = typed;
      } else {
        $("estudiante").value = "";
      }
    }, 120);
  });

  clearBtn.addEventListener("click", () => {
    clearStudent();
    input.focus();
  });

  // click afuera cierra
  document.addEventListener("mousedown", (e) => {
    const combo = input.closest(".combo");
    if (combo && !combo.contains(e.target)) hideList();
  });
}

// =========================
// Init
// =========================
function reset(){
  $("studentSearch").value = "";
  $("estudiante").value = "";
  $("fechaPago").value = todayISO_();
  renderList(STUDENTS);
  setStatus(`Listo. (${STUDENTS.length} estudiantes) ✅`);
  $("studentSearch").focus();
}

function todayISO_(){
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}

function init(){
  $("fechaPago").value = todayISO_();

  $("btnNuevo").addEventListener("click", reset);

  $("btnTestMeta")?.addEventListener("click", () => {
    const u = `${WEBAPP_URL}?action=meta&callback=cb_test&_=${Date.now()}`;
    window.open(u, "_blank");
  });

  $("formCP").addEventListener("submit", async (e) => {
    e.preventDefault();

    try{
      setStatus("Guardando...");
      const datos = buildDatos();
      const err = validate(datos);
      if (err){ setStatus(err); toast(err); return; }

      await submit(datos);
      setStatus("Enviado ✅");
      toast("Clase de prueba registrada ✅");
      reset();
    }catch(err){
      setStatus("No guardó.");
      toast(err?.message || "No guardó.");
      console.error(err);
    }
  });
}

(async () => {
  try{
    init();
    await loadMeta();
    initCombo();
    reset();
  }catch(err){
    setStatus("No cargó listas.");
    toast((err?.message || "No cargó listas.") + "");
    console.error(err);
    // bloquea botones
    $("btnGuardar").disabled = true;
    $("btnNuevo").disabled = true;
  }
})();
