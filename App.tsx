import React, { useMemo, useState, useEffect } from 'react'

type Level = { id: string, name: string, score: number }
type Student = { id: string, name: string, team?: string }
type Criterion = { id: string, name: string, dimension?: string, weight: number, descriptors: Record<string,string> }
type Weights = { auto: number, peer: number, teacher: number }
type EvalCell = { auto?: string|null, peer?: string|null, teacher?: string|null, evidence?: string, comment?: string }
type Evaluations = Record<string, Record<string, EvalCell>> // studentId -> criterionId -> cell
type PeerPoint = { id: string, team: string, evaluatorId: string, evaluatedId: string, points: number, note?: string }
type State = {
  course: { name: string, context: string },
  levels: Level[],
  weights: Weights,
  students: Student[],
  criteria: Criterion[],
  evaluations: Evaluations,
  peerPointsConfig: { pointsToDistribute: number, applyAsTeamworkModifier: boolean, maxBonusPct: number },
  peerPoints: PeerPoint[],
}

const uid = () => Math.random().toString(36).slice(2,9)
const LS_KEY = 'rubric_app_general_v1'

const DEFAULT_LEVELS: Level[] = [
  { id: uid(), name: 'Inicial', score: 1 },
  { id: uid(), name: 'En progreso', score: 2 },
  { id: uid(), name: 'Logrado', score: 3 },
  { id: uid(), name: 'Avanzado', score: 4 },
]
const DEFAULT_WEIGHTS: Weights = { auto: 20, peer: 30, teacher: 50 }
const DEMO_STUDENTS: Student[] = [
  { id: uid(), name: 'Ana', team: 'Equipo A' },
  { id: uid(), name: 'Luis', team: 'Equipo A' },
  { id: uid(), name: 'María', team: 'Equipo A' },
  { id: uid(), name: 'Sofía', team: 'Equipo B' },
]
const DEMO_CRITERIA: Criterion[] = [
  { id: uid(), name: 'Solución al problema', dimension: 'Producto', weight: 30, descriptors: {
    'Inicial': 'Describe ideas generales sin viabilidad clara.',
    'En progreso': 'Propone una solución parcial con justificación limitada.',
    'Logrado': 'Integra decisiones coherentes y justificadas.',
    'Avanzado': 'Integra visión sistémica y propone mejoras iterativas.',
  }},
  { id: uid(), name: 'Justificación con datos', dimension: 'Proceso', weight: 25, descriptors: {
    'Inicial': 'Aporta datos sin relación clara con la decisión.',
    'En progreso': 'Usa datos con algunos supuestos sin evidenciar.',
    'Logrado': 'Usa datos correctos y explicita supuestos.',
    'Avanzado': 'Analiza escenarios/alternativas y valida supuestos.',
  }},
  { id: uid(), name: 'Comunicación', dimension: 'Comunicación', weight: 25, descriptors: {
    'Inicial': 'Estructura débil y fuentes poco claras.',
    'En progreso': 'Estructura básica y algunas fuentes citadas.',
    'Logrado': 'Estructura clara y fuentes adecuadas.',
    'Avanzado': 'Discurso persuasivo, adaptado a la audiencia.',
  }},
  { id: uid(), name: 'Trabajo en equipo', dimension: 'Colaboración', weight: 20, descriptors: {
    'Inicial': 'Roles difusos y baja participación.',
    'En progreso': 'Roles definidos, participación irregular.',
    'Logrado': 'Roles claros, participación equilibrada.',
    'Avanzado': 'Alto rendimiento colectivo y resolución colaborativa.',
  }},
]

const defaultState: State = {
  course: { name: 'Mi curso / proyecto', context: 'Describe brevemente el contexto o objetivo' },
  levels: DEFAULT_LEVELS,
  weights: DEFAULT_WEIGHTS,
  students: DEMO_STUDENTS,
  criteria: DEMO_CRITERIA,
  evaluations: {},
  peerPointsConfig: { pointsToDistribute: 10, applyAsTeamworkModifier: false, maxBonusPct: 10 },
  peerPoints: [],
}

function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [val, setVal] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial } catch { return initial }
  })
  useEffect(()=> { localStorage.setItem(key, JSON.stringify(val)) }, [key, val])
  return [val, setVal]
}

function levelScore(levels: Level[], name?: string|null) {
  if (!name) return null
  const lv = levels.find(l=> l.name === name)
  return lv ? Number(lv.score) : null
}
function maxLevelScore(levels: Level[]) { return levels.reduce((a,l)=> Math.max(a, Number(l.score)), 0) || 4 }

function computeStudentSummary(state: State, studentId: string) {
  const { criteria, evaluations, levels, weights, peerPointsConfig } = state
  const maxScore = maxLevelScore(levels)
  const evalByStudent = evaluations[studentId] || {}
  let total = 0
  let weightSum = 0

  criteria.forEach(c => {
    const ev = evalByStudent[c.id] || {}
    const a = levelScore(levels, ev.auto)
    const p = levelScore(levels, ev.peer)
    const t = levelScore(levels, ev.teacher)
    const piece = c.weight/100 * (
      (a != null ? (a/maxScore)*weights.auto : 0) +
      (p != null ? (p/maxLevelScore(levels))*weights.peer : 0) +
      (t != null ? (t/maxLevelScore(levels))*weights.teacher : 0)
    )
    total += piece
    weightSum += c.weight
  })

  let percent = total // si tipos suman 100 y criterios 100, queda [0..100]

  // Bono por coevaluación (opcional)
  let bonus = 0
  if (peerPointsConfig.applyAsTeamworkModifier) {
    const st = state.students.find(s=> s.id === studentId)
    if (st?.team) {
      const received = state.peerPoints.filter(pp => pp.team === st.team && pp.evaluatedId === studentId)
      const evaluatorsCount = new Set(received.map(r=> r.evaluatorId)).size
      const denom = Math.max(1, peerPointsConfig.pointsToDistribute * evaluatorsCount)
      const ratio = Math.min(1.5, received.reduce((s,r)=> s + (Number(r.points)||0), 0) / denom)
      bonus = (percent * (peerPointsConfig.maxBonusPct/100)) * (ratio - 1)
    }
  }
  percent = Math.max(0, Math.min(100, percent + bonus))
  return { weightSum, percent }
}

export default function App() {
  const [state, setState] = usePersistentState<State>(LS_KEY, defaultState)
  const [selectedStudent, setSelectedStudent] = useState<string>(state.students[0]?.id || '')
  const sumWeights = useMemo(()=> state.weights.auto + state.weights.peer + state.weights.teacher, [state.weights])
  const criteriaSum = useMemo(()=> state.criteria.reduce((s,c)=> s + (c.weight||0), 0), [state.criteria])
  const [temp, setTemp] = useState<any>({})

  function updateCourse(field: 'name'|'context', value: string) {
    setState(prev => ({ ...prev, course: { ...prev.course, [field]: value } }))
  }
  function addStudent() { setState(prev => ({ ...prev, students: [...prev.students, { id: uid(), name: '', team: '' }] })) }
  function updateStudent(id: string, field: 'name'|'team', value: string) {
    setState(prev => ({ ...prev, students: prev.students.map(s => s.id===id ? { ...s, [field]: value } : s) }))
  }
  function removeStudent(id: string) { setState(prev => ({ ...prev, students: prev.students.filter(s=> s.id!==id) })) }

  function addCriterion() { setState(prev => ({ ...prev, criteria: [...prev.criteria, { id: uid(), name: '', dimension: '', weight: 0, descriptors: {} }] })) }
  function updateCriterion(id: string, patch: Partial<Criterion>) {
    setState(prev => ({ ...prev, criteria: prev.criteria.map(c => c.id===id ? { ...c, ...patch } : c) }))
  }
  function removeCriterion(id: string) { setState(prev => ({ ...prev, criteria: prev.criteria.filter(c=> c.id!==id) })) }
  function setWeights(patch: Partial<Weights>) { setState(prev => ({ ...prev, weights: { ...prev.weights, ...patch } })) }
  function setLevels(newLevels: Level[]) { setState(prev => ({ ...prev, levels: newLevels })) }

  function setEvaluation(studentId: string, criterionId: string, field: keyof EvalCell, value: any) {
    setState(prev => ({
      ...prev,
      evaluations: {
        ...prev.evaluations,
        [studentId]: {
          ...(prev.evaluations[studentId] || {}),
          [criterionId]: {
            ...((prev.evaluations[studentId] || {})[criterionId] || {}),
            [field]: value
          }
        }
      }
    }))
  }
  function addPeerPoint(row: Omit<PeerPoint,'id'>) { setState(prev => ({ ...prev, peerPoints: [...prev.peerPoints, { id: uid(), ...row }] })) }
  function removePeerPoint(id: string) { setState(prev => ({ ...prev, peerPoints: prev.peerPoints.filter(p=> p.id!==id) })) }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rubrica_general_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { try { setState(JSON.parse(String(reader.result))) } catch { alert('Archivo inválido') } }
    reader.readAsText(file)
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Generador de Rúbricas Formativas</h1>
          <p className="text-sm text-slate-600">General y flexible · Auto / Co / Hetero · Ponderaciones · Reportes · Export/Import</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={exportJSON}>Exportar JSON</button>
          <label className="btn">
            Importar
            <input type="file" accept="application/json" onChange={importJSON} className="hidden" />
          </label>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 space-y-4">
          <div className="card">
            <div className="text-lg font-semibold mb-2">1) Configuración</div>
            <div className="space-y-3">
              <div>
                <div className="label">Nombre del curso/proyecto</div>
                <input className="input" value={state.course.name} onChange={e=> updateCourse('name', e.target.value)} />
              </div>
              <div>
                <div className="label">Contexto</div>
                <input className="input" value={state.course.context} onChange={e=> updateCourse('context', e.target.value)} />
              </div>

              <div className="divider"></div>
              <div className="font-semibold">Niveles de logro</div>
              {state.levels.map(lv => (
                <div key={lv.id} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-7" value={lv.name} onChange={e=> setLevels(state.levels.map(l=> l.id===lv.id? { ...l, name: e.target.value } : l))} />
                  <input className="input col-span-3" type="number" value={lv.score} onChange={e=> setLevels(state.levels.map(l=> l.id===lv.id? { ...l, score: Number(e.target.value) } : l))} />
                  <button className="btn col-span-2" onClick={()=> setLevels(state.levels.filter(l=> l.id!==lv.id))} disabled={state.levels.length<=2}>Eliminar</button>
                </div>
              ))}
              <button className="btn" onClick={()=> setLevels([...state.levels, { id: uid(), name: '', score: 0 }])}>Añadir nivel</button>

              <div className="divider"></div>
              <div className="font-semibold">Pesos por tipo de evaluación</div>
              {(['auto','peer','teacher'] as const).map(k => (
                <div key={k} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4 capitalize">{k}</div>
                  <input className="input col-span-6" type="number" value={state.weights[k]} onChange={e=> setWeights({ [k]: Number(e.target.value) } as any)} />
                  <div className="col-span-2 text-sm">%</div>
                </div>
              ))}
              <div className="text-sm text-slate-600">Suma actual: <b>{sumWeights}%</b> {sumWeights!==100 && <span className="badge ml-2">No es 100%</span>}</div>

              <div className="divider"></div>
              <div className="font-semibold">Coevaluación</div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7">
                  <div className="label">Puntos a repartir por evaluador</div>
                  <input className="input" type="number" value={state.peerPointsConfig.pointsToDistribute}
                    onChange={e=> setState(prev=> ({...prev, peerPointsConfig: { ...prev.peerPointsConfig, pointsToDistribute: Number(e.target.value) }}))} />
                </div>
                <div className="col-span-5">
                  <div className="label">Bono máximo (%)</div>
                  <input className="input" type="number" value={state.peerPointsConfig.maxBonusPct}
                    onChange={e=> setState(prev=> ({...prev, peerPointsConfig: { ...prev.peerPointsConfig, maxBonusPct: Number(e.target.value) }}))} />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={state.peerPointsConfig.applyAsTeamworkModifier} onChange={e=> setState(prev=> ({...prev, peerPointsConfig: { ...prev.peerPointsConfig, applyAsTeamworkModifier: e.target.checked }}))} />
                Aplicar puntos de coevaluación como bono
              </label>
            </div>
          </div>

          <div className="card">
            <div className="text-lg font-semibold mb-2">2) Estudiantes</div>
            <div className="space-y-2">
              {state.students.map(st => (
                <div key={st.id} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-5" placeholder="Nombre" value={st.name} onChange={e=> updateStudent(st.id,'name',e.target.value)} />
                  <input className="input col-span-5" placeholder="Equipo (opcional)" value={st.team||''} onChange={e=> updateStudent(st.id,'team',e.target.value)} />
                  <button className="btn col-span-2" onClick={()=> removeStudent(st.id)}>Eliminar</button>
                </div>
              ))}
              <button className="btn" onClick={addStudent}>Añadir estudiante</button>
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          <div className="card">
            <div className="text-lg font-semibold mb-2">3) Criterios</div>
            <div className="text-sm text-slate-600 mb-2">La suma sugerida de pesos es 100%.</div>
            {state.criteria.map(cr => (
              <div key={cr.id} className="border rounded-2xl p-4 mb-3">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-5" placeholder="Nombre del criterio" value={cr.name} onChange={e=> updateCriterion(cr.id,{ name: e.target.value })} />
                  <input className="input col-span-4" placeholder="Dimensión (opcional)" value={cr.dimension||''} onChange={e=> updateCriterion(cr.id,{ dimension: e.target.value })} />
                  <input className="input col-span-2" type="number" placeholder="Peso %" value={cr.weight} onChange={e=> updateCriterion(cr.id,{ weight: Number(e.target.value) })} />
                  <button className="btn col-span-1" onClick={()=> removeCriterion(cr.id)}>×</button>
                </div>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {state.levels.map(lv => (
                    <div key={lv.id}>
                      <div className="label text-xs">Descriptor: {lv.name}</div>
                      <textarea className="input min-h-[72px]" value={cr.descriptors?.[lv.name]||''}
                        onChange={e=> updateCriterion(cr.id, { descriptors: { ...cr.descriptors, [lv.name]: e.target.value } })} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button className="btn" onClick={addCriterion}>Añadir criterio</button>
              <span className="text-sm text-slate-600">Suma de pesos: <b>{criteriaSum}%</b> {criteriaSum!==100 && <span className="badge ml-2">Sugerido 100%</span>}</span>
            </div>
          </div>

          <div className="card">
            <div className="text-lg font-semibold mb-2">4) Evaluar</div>
            <div className="grid grid-cols-12 gap-2 items-center mb-3">
              <div className="col-span-12 md:col-span-4">
                <div className="label">Estudiante</div>
                <select className="select" value={selectedStudent} onChange={e=> setSelectedStudent(e.target.value)}>
                  {state.students.map(s=> <option key={s.id} value={s.id}>{s.name || '(sin nombre)'}</option>)}
                </select>
              </div>
              <div className="col-span-12 md:col-span-8 text-right text-sm text-slate-600">Pesos: Auto {state.weights.auto}% · Co {state.weights.peer}% · Hetero {state.weights.teacher}%</div>
            </div>

            {state.criteria.map(cr => {
              const ev = (state.evaluations[selectedStudent] || {})[cr.id] || {}
              return (
                <div key={cr.id} className="border rounded-2xl p-4 mb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{cr.name}</div>
                      <div className="text-xs text-slate-600">{cr.dimension}</div>
                    </div>
                    <span className="badge">Peso: {cr.weight}%</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-2 mt-2">
                    {(['auto','peer','teacher'] as const).map(k => (
                      <div key={k}>
                        <div className="label capitalize">{k}</div>
                        <select className="select" value={ev[k]||''} onChange={e=> setEvaluation(selectedStudent, cr.id, k, e.target.value)}>
                          <option value="">— Selecciona —</option>
                          {state.levels.map(l=> <option key={l.id} value={l.name}>{l.name} ({l.score})</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 mt-2">
                    <div>
                      <div className="label">Evidencias (URL)</div>
                      <input className="input" value={ev.evidence||''} onChange={e=> setEvaluation(selectedStudent, cr.id, 'evidence', e.target.value)} />
                    </div>
                    <div>
                      <div className="label">Comentario formativo</div>
                      <input className="input" value={ev.comment||''} onChange={e=> setEvaluation(selectedStudent, cr.id, 'comment', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-2 mt-3">
                    {state.levels.map(lv => (
                      <div key={lv.id} className="bg-slate-50 rounded-xl p-3">
                        <div className="text-sm font-semibold">{lv.name}</div>
                        <div className="text-xs text-slate-600 whitespace-pre-wrap">{cr.descriptors?.[lv.name]||''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <StudentSummary state={state} studentId={selectedStudent} detailed />
          </div>

          <div className="card">
            <div className="text-lg font-semibold mb-2">5) Coevaluación — Reparto de puntos</div>
            <div className="grid md:grid-cols-5 gap-2 items-end">
              <div className="md:col-span-2">
                <div className="label">Evaluador</div>
                <select className="select" value={temp.evaluatorId||''} onChange={e=> setTemp((p:any)=> ({...p, evaluatorId: e.target.value}))}>
                  <option value="">—</option>
                  {state.students.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="label">Evaluado</div>
                <select className="select" value={temp.evaluatedId||''} onChange={e=> setTemp((p:any)=> ({...p, evaluatedId: e.target.value}))}>
                  <option value="">—</option>
                  {state.students.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div className="label">Puntos</div>
                <input className="input" type="number" value={temp.points||''} onChange={e=> setTemp((p:any)=> ({...p, points: Number(e.target.value)}))} />
              </div>
              <div className="md:col-span-5">
                <div className="label">Nota (opcional)</div>
                <input className="input" value={temp.note||''} onChange={e=> setTemp((p:any)=> ({...p, note: e.target.value}))} />
              </div>
              <div className="md:col-span-5 text-right">
                <button className="btn btn-primary" onClick={()=> {
                  const ev = state.students.find(s=> s.id === temp.evaluatorId)
                  const ed = state.students.find(s=> s.id === temp.evaluatedId)
                  if (!ev || !ed) return alert('Selecciona evaluador y evaluado')
                  if (!ev.team || !ed.team || ev.team !== ed.team) return alert('Deben pertenecer al mismo equipo')
                  if (ev.id === ed.id) return alert('No se puede autoasignar puntos')
                  addPeerPoint({ team: ev.team, evaluatorId: ev.id, evaluatedId: ed.id, points: Number(temp.points)||0, note: temp.note||'' })
                  setTemp({})
                }}>Agregar</button>
              </div>
            </div>

            <div className="divider"></div>
            <div className="font-semibold">Registros</div>
            <div className="space-y-2">
              {state.peerPoints.length===0 && <div className="text-sm text-slate-600">No hay registros aún.</div>}
              {state.peerPoints.map(pp => {
                const ev = state.students.find(s=> s.id===pp.evaluatorId)?.name || '(?)'
                const ed = state.students.find(s=> s.id===pp.evaluatedId)?.name || '(?)'
                return (
                  <div key={pp.id} className="flex items-center justify-between border rounded-xl p-3">
                    <div className="text-sm">[{pp.team}] <b>{ev}</b> → <b>{ed}</b> : {pp.points} pts {pp.note? `— ${pp.note}`: ''}</div>
                    <button className="btn" onClick={()=> removePeerPoint(pp.id)}>Eliminar</button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="text-lg font-semibold mb-2">6) Reportes</div>
            <div className="grid md:grid-cols-2 gap-4">
              <StudentSummary state={state} studentId={selectedStudent} />
              <div>
                <div className="font-semibold mb-2">Reporte general</div>
                <div className="space-y-2">
                  {state.students.map(s => {
                    const sum = computeStudentSummary(state, s.id)
                    return (
                      <div key={s.id} className="border rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{s.name}</div>
                            <div className="text-xs text-slate-600">{s.team || 'Sin equipo'}</div>
                          </div>
                          <span className="badge">{sum.percent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded mt-2">
                          <div className="bg-blue-600 h-2 rounded" style={{ width: Math.min(100, Math.max(0, sum.percent)) + '%' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentSummary({ state, studentId, detailed=false }:{ state: State, studentId: string, detailed?: boolean }) {
  const sum = useMemo(()=> computeStudentSummary(state, studentId), [state, studentId])
  const evalByStudent = state.evaluations[studentId] || {}
  const maxScore = maxLevelScore(state.levels)

  return (
    <div className="card">
      <div className="text-lg font-semibold mb-2">Reporte por estudiante</div>
      <div className="flex items-center gap-2 text-sm mb-2">
        <div>Suma de pesos:</div>
        <span className="badge">{sum.weightSum}%</span>
      </div>
      <div>
        <div className="text-sm">Porcentaje total estimado</div>
        <div className="w-full bg-slate-200 h-2 rounded mt-1">
          <div className="bg-blue-600 h-2 rounded" style={{ width: Math.min(100, Math.max(0, sum.percent)) + '%' }}></div>
        </div>
        <div className="text-sm mt-1"><b>{sum.percent.toFixed(1)}%</b></div>
      </div>

      {detailed && (
        <div className="space-y-2 mt-2">
          {state.criteria.map(cr => {
            const ev = evalByStudent[cr.id] || {}
            const a = levelScore(state.levels, ev.auto)
            const p = levelScore(state.levels, ev.peer)
            const t = levelScore(state.levels, ev.teacher)
            const piece = (cr.weight/100) * (
              (a != null ? (a/maxScore) * state.weights.auto : 0) +
              (p != null ? (p/maxScore) * state.weights.peer : 0) +
              (t != null ? (t/maxScore) * state.weights.teacher : 0)
            )
            return (
              <div key={cr.id} className="border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{cr.name}</div>
                  <span className="badge">+{piece.toFixed(2)} pts</span>
                </div>
                <div className="text-xs text-slate-600">Auto: {ev.auto || '—'} · Co: {ev.peer || '—'} · Hetero: {ev.teacher || '—'} · Peso: {cr.weight}%</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
