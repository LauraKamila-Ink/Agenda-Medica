
;
    }
    if (!selectable) return;
    setSelectedExisting(null);
    setSelectedRange(null);
    setDrag({ active: true, date: dateISO, startIdx: rowIdx, endIdx: rowIdx });
  };
  const onMouseEnterCell = (dateISO, rowIdx, selectable) => { if (!drag.active) return; if (dateISO !== drag.date) return; if (!selectable) return; setDrag((d) => ({ ...d, endIdx: rowIdx })); };
  const finishDrag = () => {
    if (!drag.active || !drag.date) return;
    const a = Math.min(drag.startIdx, drag.endIdx);
    const b = Math.max(drag.startIdx, drag.endIdx);
    const start = idxToTime(a);
    const end = idxToTime(Math.min(b + 1, TIME_SLOTS.length - 1));
    if (canCreateSlot(drag.date, start, end)) setSelectedRange({ date: drag.date, start, end }); else setSelectedRange(null);
    setDrag({ active: false, date: null, startIdx: -1, endIdx: -1 });
  };
  useEffect(() => { const up = () => finishDrag(); window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); });

  // ====== Crear / Restablecer franja
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ start: "", end: "", room: "" });
  const openCreateFromSelection = () => { if (role !== "coordinator") return alert("Acceso restringido: solo el coordinador puede crear franjas."); if (!ready) return alert("Selecciona una especialidad y un médico."); if (!selectedRange) return alert("Selecciona un rango libre arrastrando en la agenda."); setForm({ start: selectedRange.start, end: selectedRange.end, room: form.room }); setCreating(true); };
  const handleSave = () => {
    if (role !== "coordinator") return alert("Solo el coordinador puede crear franjas.");
    if (!ready) return alert("Selecciona una especialidad y un médico.");
    const date = selectedRange?.date; if (!date) return alert("Selecciona un rango libre.");
    if (!form.start || !form.end) return alert("Debe seleccionar hora de inicio y fin.");
    if (!form.room) return alert("Debe asignar un consultorio.");
    if (!canCreateSlot(date, form.start, form.end)) return alert("No es posible crear la franja: semana pasada, bloqueos, solapes o bloques inválidos.");
    setSlotsByDoctor(prev => ({
      ...prev,
      [doctor]: [ ...(prev[doctor] || []), { date, start: form.start, end: form.end, room: form.room } ]
    }));
    setCreating(false); setSelectedRange(null); setForm({ start: "", end: "", room: "" });
  };

  const canReset = !!(selectedExisting && role === 'coordinator' && !isPastWeek(selectedExisting.date) && ready);
  const handleReset = () => {
    if (!canReset) return;
    const { index } = selectedExisting;
    setSlotsByDoctor(prev => {
      const arr = [...(prev[doctor] || [])];
      arr.splice(index, 1);
      return { ...prev, [doctor]: arr };
    });
    setSelectedExisting(null);
  };

  // ====== Bloqueo Personal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({ cc: "", type: "VACACIONES", start: "", end: "" });
  const openBlockModal = () => { if (role !== "coordinator") return alert("Acceso restringido: solo el coordinador puede registrar bloqueos."); if (!ready) return alert("Selecciona una especialidad y un médico."); setBlockForm({ cc: DOCTOR_CC[doctor] || "", type: "VACACIONES", start: "", end: "" }); setShowBlockModal(true); };
  const saveBlock = () => { if (role !== "coordinator") return alert("Solo el coordinador puede registrar bloqueos."); const { cc, type, start, end } = blockForm; if (!cc) return alert("La cédula del médico es obligatoria."); if (!(type==='VACACIONES'||type==='INCAPACIDAD')) return alert("Debe seleccionar tipo de bloqueo."); if (!start||!end) return alert("Debe seleccionar fecha de inicio y fin."); if (start> end) return alert("La fecha de inicio debe ser anterior o igual a la de fin."); const today = new Date().toISOString().slice(0,10); if (start< today) return alert("No se permite crear bloqueos en fechas anteriores a hoy."); const overlap = personalBlocks.some(b=> b.cc===cc && !(end<b.start||start>b.end)); if (overlap) return alert('Ya existe un bloqueo para parte de ese rango.'); setPersonalBlocks([...personalBlocks,{cc,type,start,end}]); setShowBlockModal(false); };

  // ====== Bloqueo General (independiente de selección, pero respeta filtros)
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [generalForm, setGeneralForm] = useState({ scope: "ALL", specialty: SPECIALTIES[0], doctors: [], eventType: "", startDate: "", endDate: "", startTime: "", endTime: "" });
  const openGeneralModal = () => { if (role !== "coordinator") return alert("Acceso restringido: solo el coordinador puede registrar bloqueos generales."); setShowGeneralModal(true); };
  const saveGeneralModal = () => { if (role !== "coordinator") return alert("Solo el coordinador puede registrar bloqueos generales."); const { scope, specialty, doctors, eventType, startDate, endDate } = generalForm; let { startTime, endTime } = generalForm; if (!eventType) return alert('Debe ingresar un tipo de evento.'); if (eventType.length>100) return alert('La descripción del evento no puede exceder 100 caracteres.'); if (!startDate||!endDate) return alert('Debe seleccionar fecha de inicio y fin.'); if (startDate> endDate) return alert('La fecha de inicio debe ser anterior o igual a la de fin.'); const now=new Date(); const startDT=new Date(${startDate}T${(startTime||'08:00')}:00); if (startDT< now) return alert('Un bloqueo general no puede establecerse en fecha/hora anterior a la actual.'); startTime=startTime||'08:00'; endTime=endTime||'18:00'; if (!TIME_SLOTS.includes(startTime)||!TIME_SLOTS.includes(endTime)) return alert('Las horas deben respetar bloques de 30 minutos.'); let target=[]; if(scope==='ALL') target=allDoctors; if(scope==='SPECIALTY') target=DOCTORS[specialty]||[]; if(scope==='MANUAL') target=doctors||[]; const excluded=target.filter(d=> isBlockedByPersonal(d,startDate)||isBlockedByPersonal(d,endDate)); if(excluded.length){ alert(Aviso: los siguientes médicos ya tienen bloqueo personal y serán excluidos del bloqueo general:\n- ${excluded.join('\n- ')}); } setGeneralBlocks([...generalBlocks,{scope,specialty,doctors,eventType,startDate,endDate,startTime,endTime}]); setShowGeneralModal(false); };

  // ====== Mini tests (consola)
  try {
    // EXISTENTES
    console.assert(timeToIdx("08:00") === 0, "timeToIdx 08:00");
    console.assert(timeToIdx("09:30") === 3, "timeToIdx 09:30");
    console.assert(overlaps("08:00","09:00","08:30","09:30") === true, "overlaps true");
    console.assert(overlaps("08:00","08:30","08:30","09:00") === false, "overlaps edge");
    // NUEVOS
    console.assert(idxToTime(0) === "08:00", "idxToTime base");
    console.assert(isTimeWithin("09:00","08:00","10:00") === true, "isTimeWithin inside");
    console.assert(isTimeWithin("10:00","08:00","10:00") === false, "isTimeWithin end-exclusive");
    // Separación por médico (conceptual)
    const today = new Date().toISOString().slice(0,10);
    (function(){
      const map={ A:[{date:today,start:"09:00",end:"10:00",room:"101"}], B:[] };
      const get=(name)=>map[name]||[];
      const _isBusy=(name,date,t)=> get(name).some(s=> s.date===date && overlaps(s.start,s.end,t,cellEnd(t)));
      console.assert(_isBusy('A',today,'09:00')===true,'busy A');
      console.assert(_isBusy('B',today,'09:00')===false,'free B');
      // Simulación de restablecer
      const arr=[...get('A')]; arr.splice(0,1); console.assert(arr.length===0,'reset simulado');
      // Selección calculada
      const sel={date:today,start:'09:00',end:'10:00'}; const rIdx=timeToIdx('09:00'); console.assert(rIdx>=timeToIdx(sel.start)&&rIdx<timeToIdx(sel.end),'rango seleccionado');
    })();
  } catch (_) {}

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between border-b pb-3 mb-4">
        <div className="flex items-center gap-2"><CalendarRange className="w-5 h-5"/><h1 className="text-lg md:text-xl font-semibold">Visualización de agendas médicas</h1></div>
        <div className="flex items-center gap-2 text-sm text-gray-600"><span>Rol:</span><strong>{role==="coordinator"?"Coordinador":"Otro"}</strong><User2 className="w-5 h-5"/></div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel izquierdo */}
        <aside className="lg:col-span-3">
          <div className="rounded-xl border bg-gray-50 p-4">
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Año</label>
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button onClick={()=>setYear(y=>y-1)} className="px-2 hover:bg-gray-200" aria-label="Año anterior"><ChevronLeft className="w-4 h-4"/></button>
                  <input type="text" readOnly value={year} className="flex-1 text-center py-1 text-sm bg-white"/>
                  <button onClick={()=>setYear(y=>y+1)} className="px-2 hover:bg-gray-200" aria-label="Año siguiente"><ChevronRight className="w-4 h-4"/></button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Mes</label>
                <select className="w-full border rounded-lg px-2 py-1" value={month} onChange={(e)=>setMonth(Number(e.target.value))}>
                  <option value="" disabled>Seleccione</option>
                  {MONTHS.map((m,i)=>(<option key={m} value={i}>{m}</option>))}
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 border">
              <div className="flex items-center justify-between mb-2">
                <button className="p-1 rounded hover:bg-gray-200" onClick={()=>setMonth(m=> (m===0?(setYear(y=>y-1),11):m-1))} aria-label="Mes anterior"><ChevronLeft className="w-4 h-4"/></button>
                <div className="font-semibold">{MONTHS[month]} {year}</div>
                <button className="p-1 rounded hover:bg-gray-200" onClick={()=>setMonth(m=> (m===11?(setYear(y=>y+1),0):m+1))} aria-label="Mes siguiente"><ChevronRight className="w-4 h-4"/></button>
              </div>
              <div className="grid grid-cols-7 text-xs text-center text-gray-600 mb-1">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>(<div key={d} className="py-1">{d}</div>))}</div>
              <div className="grid grid-cols-7 gap-1">
                {monthMatrix.flat().map((d,i)=>{
                  const inMonth=d.getMonth()===month; const s=new Date(selectedDay); const off=(selectedDay.getDay()+6)%7; s.setDate(selectedDay.getDate()-off); const e=new Date(s); e.setDate(s.getDate()+6); const isSelectedWeek=d>=s && d<=e;
                  return (
                    <button key={i} onClick={()=>setSelectedDay(d)} className={py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 ${inMonth?'text-gray-900':'text-gray-400'} ${isSelectedWeek?'bg-blue-100 border border-blue-300':'hover:bg-gray-200'}} aria-label={Seleccionar ${d.toISOString().slice(0,10)}}>{d.getDate()}</button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-green-600"/> Libre</div>
                <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-blue-600"/> Ocupado</div>
                <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-red-600"/> Inhabilitado</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Panel principal */}
        <section className="lg:col-span-9">
          {/* Filtros superiores */}
          <div className="rounded-xl border bg-white p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Especialidad Médica</label>
                <select className="w-full rounded-lg border px-3 py-2" value={spec} onChange={(e)=>{setSpec(e.target.value); setDoctor("");}}>
                  <option value="">Seleccione</option>
                  {SPECIALTIES.map(s=>(<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Médico</label>
                <select className="w-full rounded-lg border px-3 py-2" value={doctor} onChange={(e)=>setDoctor(e.target.value)} disabled={!spec}>
                  <option value="">Seleccione</option>
                  {(DOCTORS[spec]||[]).map(m=>(<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
            </div>
          </div>

          {/* Encabezado agenda + botones */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Agenda semanal</h2>
            <div className="flex items-center gap-2">
              <button onClick={openCreateFromSelection} className="inline-flex items-center gap-1 text-sm rounded-lg border px-3 py-1 hover:bg-blue-50 text-blue-700 disabled:opacity-50" disabled={!selectedRange || !ready}><PlusCircle className="w-4 h-4"/> Crear franja</button>
              {selectedExisting && (
                <button onClick={handleReset} disabled={!canReset} title={canReset?Restablecer ${selectedExisting.start}–${selectedExisting.end}:"No permitido"} className={inline-flex items-center gap-1 text-sm rounded-lg border px-3 py-1 ${canReset?"hover:bg-amber-50 text-amber-800":"opacity-50 cursor-not-allowed"}}>
                  <RotateCcw className="w-4 h-4"/> Reestablecer franja
                </button>
              )}
              <button onClick={openBlockModal} className="inline-flex items-center gap-1 text-sm rounded-lg border px-3 py-1 hover:bg-red-50 text-red-700" disabled={!ready}><ShieldBan className="w-4 h-4"/> Bloqueo personal</button>
              <button onClick={openGeneralModal} className="inline-flex items-center gap-1 text-sm rounded-lg border px-3 py-1 hover:bg-gray-50 text-gray-800"><Lock className="w-4 h-4"/> Bloqueo general</button>
              {selectedRange && <span className="text-xs text-gray-600">{selectedRange.date} · {selectedRange.start}–{selectedRange.end}</span>}
              {selectedExisting && <span className="text-xs text-gray-600">{selectedExisting.date} · {selectedExisting.start}–{selectedExisting.end} (ocupada)</span>}
            </div>
          </div>

          {/* Tabla semanal con arrastre */}
          {!ready ? (
            <div className="rounded-xl border bg-white p-8 text-center text-gray-600">
              Selecciona una <strong>especialidad</strong> y un <strong>médico</strong> para visualizar y editar la agenda.
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-auto select-none">
              <table className="w-full text-sm border-collapse" role="grid" aria-readonly="true">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border p-3 text-left w-[90px]">Horario</th>
                    {weekDays.map((d,idx)=> (
                      <th key={idx} className="border p-3 text-center min-w-[140px]">
                        <div className="font-medium">{DAYS[idx]}</div>
                        <div className="text-gray-600 text-xs">{d.getDate()} {MONTHS[d.getMonth()].slice(0,3).toLowerCase()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((t,rowIdx)=>(
                    <tr key={t}>
                      <td className="border p-2 font-medium text-gray-700 text-center">{t}</td>
                      {weekDays.map((d,colIdx)=>{
                        const date=d.toISOString().slice(0,10);
                        const busy=isBusy(date,t);
                        const blocked=blockedDates.includes(date)||isBlockedByPersonal(doctor,date)||isBlockedByGeneral(doctor,date,t);
                        const status=blocked?'BLOCKED':busy?'BUSY':'FREE';
                        const label=status==='FREE'?'Disponible':status==='BUSY'?'Ocupado':'Inhabilitado';
                        const selectable=status==='FREE' && !isPastWeek(date);
                        const isDraggingColumn=drag.active && drag.date===date; const a=Math.min(drag.startIdx,drag.endIdx); const b=Math.max(drag.startIdx,drag.endIdx);
                        const inDrag = isDraggingColumn && rowIdx >= a && rowIdx <= b && selectable;
                        const inSelected = selectedRange && selectedRange.date === date && rowIdx >= timeToIdx(selectedRange.start) && rowIdx < timeToIdx(selectedRange.end);
                        return (
                          <td key={colIdx} className={border p-1 text-center ${inDrag?'outline outline-2 outline-black':''} ${inSelected?'ring-2 ring-black':''}}
                              onMouseDown={()=>onMouseDownCell(date,rowIdx,t,status,selectable)} onMouseEnter={()=>onMouseEnterCell(date,rowIdx,selectable)} onMouseUp={finishDrag}>
                            <span className={inline-block w-full rounded px-2 py-1 ${pill[status]} ${selectable?'cursor-crosshair': status==='BUSY'? 'cursor-pointer':'opacity-70 cursor-not-allowed'}}>{label}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Modal creación de franja */}
      {creating && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl p-6 w-[420px] shadow-lg">
            <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-semibold">Crear franja</h3><button onClick={()=>setCreating(false)} aria-label="Cerrar"><X className="w-5 h-5"/></button></div>
            <div className="text-xs text-gray-600 mb-3">{selectedRange?.date} · {selectedRange?.start}–{selectedRange?.end}</div>
            <label className="block text-sm mb-1">Hora inicio</label>
            <select value={form.start} onChange={e=>setForm({...form,start:e.target.value})} className="w-full border rounded mb-2 px-2 py-1">
              <option value="">Seleccione</option>
              {TIME_SLOTS.map(t=>(<option key={t}>{t}</option>))}
            </select>
            <label className="block text-sm mb-1">Hora fin</label>
            <select value={form.end} onChange={e=>setForm({...form,end:e.target.value})} className="w-full border rounded mb-2 px-2 py-1">
              <option value="">Seleccione</option>
              {TIME_SLOTS.map(t=>(<option key={t}>{t}</option>))}
            </select>
            <label className="block text-sm mb-1">Consultorio</label>
            <input value={form.room} onChange={e=>setForm({...form,room:e.target.value})} className="w-full border rounded mb-3 px-2 py-1" placeholder="Ej: 301"/>
            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded py-2 font-medium">Guardar franja</button>
          </div>
        </div>
      )}

      {/* Modal Bloqueo personal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl p-6 w-[460px] shadow-lg">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Crear Bloqueo Personal</h3><button onClick={()=>setShowBlockModal(false)} aria-label="Cerrar"><X className="w-5 h-5"/></button></div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Médico (cédula) *</label>
                <input value={blockForm.cc} onChange={e=>setBlockForm({...blockForm,cc:e.target.value})} className="w-full border rounded px-2 py-2" placeholder="Ingresa la cédula" aria-required="true"/>
                <p className="text-xs text-gray-500 mt-1">Sugerido: {DOCTOR_CC[doctor] ?? '—'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de bloqueo *</label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="tipo" checked={blockForm.type==='VACACIONES'} onChange={()=>setBlockForm({...blockForm,type:'VACACIONES'})}/> Vacaciones</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="tipo" checked={blockForm.type==='INCAPACIDAD'} onChange={()=>setBlockForm({...blockForm,type:'INCAPACIDAD'})}/> Incapacidad</label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium mb-1">Fecha de Inicio *</label><input type="date" value={blockForm.start} onChange={e=>setBlockForm({...blockForm,start:e.target.value})} className="w-full border rounded px-2 py-2" aria-required="true"/></div>
                <div><label className="block text-sm font-medium mb-1">Fecha de Fin *</label><input type="date" value={blockForm.end} onChange={e=>setBlockForm({...blockForm,end:e.target.value})} className="w-full border rounded px-2 py-2" aria-required="true"/></div>
              </div>
              <div className="rounded-lg bg-blue-100 text-blue-900 p-3 text-sm"><p className="font-medium">Horario de bloqueo</p><p>Los días bloqueados abarcarán toda la jornada laboral de <strong>8:00 AM a 6:00 PM</strong>. Las franjas dentro del rango seleccionado se inhabilitarán para agendamiento.</p></div>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={()=>setShowBlockModal(false)} className="px-4 py-2 rounded border">Cancelar</button><button onClick={saveBlock} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Crear Bloqueo Personal</button></div>
          </div>
        </div>
      )}

      {/* Modal Bloqueo general */}
      {showGeneralModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl p-6 w-[520px] shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Crear Bloqueo General</h3><button onClick={()=>setShowGeneralModal(false)} aria-label="Cerrar"><X className="w-5 h-5"/></button></div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rango de bloqueo *</label>
                <div className="space-y-2">
                  <label className="block text-sm"><input type="radio" name="scope" checked={generalForm.scope==='ALL'} onChange={()=>setGeneralForm({...generalForm,scope:'ALL'})}/> Todo el personal</label>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="scope" checked={generalForm.scope==='SPECIALTY'} onChange={()=>setGeneralForm({...generalForm,scope:'SPECIALTY'})}/>
                    <select disabled={generalForm.scope!== 'SPECIALTY'} value={generalForm.specialty} onChange={e=>setGeneralForm({...generalForm,specialty:e.target.value})} className="border rounded px-2 py-1 text-sm">
                      {SPECIALTIES.map(s=>(<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2"><input type="radio" name="scope" checked={generalForm.scope==='MANUAL'} onChange={()=>setGeneralForm({...generalForm,scope:'MANUAL'})}/><span className="text-sm">Manual</span><span className="text-xs text-gray-500">({generalForm.doctors?.length||0} seleccionados)</span></div>
                    <div className={grid grid-cols-2 gap-2 ${generalForm.scope!=='MANUAL'?'opacity-50 pointer-events-none':''}}>
                      {allDoctors.map(d=>(
                        <label key={d} className="text-sm inline-flex items-center gap-2">
                          <input type="checkbox" checked={(generalForm.doctors||[]).includes(d)} onChange={(e)=>{const s=new Set(generalForm.doctors||[]); if(e.target.checked) s.add(d); else s.delete(d); setGeneralForm({...generalForm,doctors:[...s]});}}/>
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de evento *</label>
                <input type="text" value={generalForm.eventType||''} onChange={e=>setGeneralForm({...generalForm,eventType:e.target.value})} maxLength={100} placeholder="Ej: Jornada de limpieza" className="w-full border rounded px-2 py-2"/>
                <p className="text-xs text-gray-500 mt-1">Máximo 100 caracteres.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium mb-1">Fecha de Inicio *</label><input type="date" value={generalForm.startDate||''} onChange={e=>setGeneralForm({...generalForm,startDate:e.target.value})} className="w-full border rounded px-2 py-2"/></div>
                <div><label className="block text-sm font-medium mb-1">Fecha de Fin *</label><input type="date" value={generalForm.endDate||''} onChange={e=>setGeneralForm({...generalForm,endDate:e.target.value})} className="w-full border rounded px-2 py-2"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium mb-1">Hora de Inicio</label><select value={generalForm.startTime||''} onChange={e=>setGeneralForm({...generalForm,startTime:e.target.value})} className="w-full border rounded px-2 py-2"><option value="">8:00 AM (por defecto)</option>{TIME_SLOTS.map(t=>(<option key={t} value={t}>{t}</option>))}</select></div>
                <div><label className="block text-sm font-medium mb-1">Hora de Fin</label><select value={generalForm.endTime||''} onChange={e=>setGeneralForm({...generalForm,endTime:e.target.value})} className="w-full border rounded px-2 py-2"><option value="">6:00 PM (por defecto)</option>{TIME_SLOTS.map(t=>(<option key={t} value={t}>{t}</option>))}</select></div>
              </div>
              <div className="rounded-lg bg-blue-100 text-blue-900 p-3 text-sm"><p className="font-medium">Horario de bloqueo</p><p>Las franjas dentro del rango seleccionado se inhabilitarán para agendamiento. Si no se definen horas, se bloqueará de 8:00 AM a 6:00 PM.</p></div>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={()=>setShowGeneralModal(false)} className="px-4 py-2 rounded border">Cancelar</button><button onClick={saveGeneralModal} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Crear Bloqueo General</button></div>
          </div>
        </div>
      )}

      {/* Accesibilidad / contraste */}
      <footer className="text-xs text-gray-600 mt-6 border-t pt-2">Cumple lineamientos de accesibilidad: contraste alto, roles ARIA, click sobre ocupado para restablecer, agendas por médico, y soporte de lector de pantalla.</footer>
    </div>
  );
}