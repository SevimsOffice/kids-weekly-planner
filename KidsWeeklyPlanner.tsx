import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, Text, ScrollView, TextInput, Pressable, Modal, Switch, Image, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Day = 'Monday'|'Tuesday'|'Wednesday'|'Thursday'|'Friday'|'Saturday'|'Sunday';
const DAYS: Day[] = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const HOURS = Array.from({ length: 15 }, (_, i) => 7 + i); // 07->21

type EventItem = {
  id: string;
  title: string;
  day: Day;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  category: string;
  color: string;
  notes?: string;
};

const defaultAccent = '#2563eb';

function timeToRow(time: string) {
  const [h, m] = time.split(':').map(Number);
  return (h - 7) + (m >= 30 ? 0.5 : 0);
}
function overlaps(a: EventItem, b: EventItem) {
  if (a.day !== b.day) return false;
  const sa = timeToRow(a.start), ea = timeToRow(a.end);
  const sb = timeToRow(b.start), eb = timeToRow(b.end);
  return Math.max(sa, sb) < Math.min(ea, eb);
}
function formatHour(h: number) {
  const whole = Math.floor(h);
  const mins = (h - whole) > 0 ? ':30' : ':00';
  const hh = ((whole % 24) + 24) % 24;
  return `${String(hh).padStart(2,'0')}${mins}`;
}

async function getLS<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
async function setLS<T>(key: string, val: T) {
  try { await AsyncStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function KidsWeeklyPlanner() {
  const [title, setTitle] = useState('Kids Weekly Planner');
  const [bgColor, setBgColor] = useState('#f8fafc');
  const [accent, setAccent] = useState(defaultAccent);
  const [photo, setPhoto] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [denseHours, setDenseHours] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);

  useEffect(() => {
    (async () => {
      setTitle(await getLS('kwp:title', 'Kids Weekly Planner'));
      setBgColor(await getLS('kwp:bgColor', '#f8fafc'));
      setAccent(await getLS('kwp:accent', defaultAccent));
      setPhoto(await getLS('kwp:photo', null));
      setEvents(await getLS('kwp:events', []));
      setDenseHours(await getLS('kwp:dense', false));
    })();
  }, []);
  useEffect(() => { setLS('kwp:title', title); }, [title]);
  useEffect(() => { setLS('kwp:bgColor', bgColor); }, [bgColor]);
  useEffect(() => { setLS('kwp:accent', accent); }, [accent]);
  useEffect(() => { setLS('kwp:photo', photo); }, [photo]);
  useEffect(() => { setLS('kwp:events', events); }, [events]);
  useEffect(() => { setLS('kwp:dense', denseHours); }, [denseHours]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
      return timeToRow(a.start) - timeToRow(a.start);
    });
  }, [events]);

  function resetForm() {
    setEditing({
      id: crypto.randomUUID(),
      title: '',
      day: 'Monday',
      start: '09:00',
      end: '10:00',
      category: 'School',
      color: accent,
      notes: '',
    });
  }
  function handleAdd() {
    resetForm();
    setOpen(true);
  }
  function saveEvent() {
    if (!editing) return;
    const { title, start, end } = editing;
    if (!title.trim()) { Alert.alert('Error', 'Please add a title'); return; }
    if (start >= end) { Alert.alert('Error', 'End time must be after start time'); return; }
    const overlapsWith = events.some(e => e.id !== editing.id && overlaps(e, editing));
    if (overlapsWith) { Alert.alert('Warning', 'This overlaps another event on the same day.'); }
    setEvents(prev => {
      const exists = prev.find(e => e.id === editing.id);
      if (exists) return prev.map(e => (e.id === editing.id ? editing : e));
      return [...prev, editing];
    });
    setOpen(false);
  }
  function deleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  function exportCSV() {
    const header = ['title','day','start','end','category','color','notes'];
    const rows = events.map(e => header.map(h => (e as any)[h] ?? ''));
    const csv = [header.join(','), ...rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kids-weekly-planner.csv'; a.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Not supported', 'CSV export is available on web.');
    }
  }

  function importCSVWeb(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const lines = text.split(/\r?\n/).filter(Boolean);
        const [h, ...rest] = lines;
        const cols = h.split(',').map(x => x.replaceAll('"','').trim());
        const out: EventItem[] = rest.map(line => {
          const items = line.match(/\"([^\"]*)\"|[^,]+/g)?.map(x => x.replaceAll('"','')) || [];
          const obj: any = {};
          cols.forEach((c, i) => (obj[c] = items[i] ?? ''));
          obj.id = crypto.randomUUID();
          return obj as EventItem;
        });
        setEvents(out);
        Alert.alert('Imported', 'Imported events from CSV');
      } catch {
        Alert.alert('Error', 'Failed to import CSV');
      }
    };
    reader.readAsText(file);
  }

  function handlePhotoUpload() {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file: File | undefined = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setPhoto(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Not supported', 'Photo upload is available on web.');
    }
  }

  function printPDF() {
    if (Platform.OS === 'web') {
      // Create a new window with the planner content for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const printContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Kids Weekly Planner</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: ${bgColor}; }
              .planner-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { display: flex; align-items: center; margin-bottom: 20px; }
              .title { font-size: 24px; font-weight: bold; color: ${accent}; margin-left: 15px; }
              .grid { display: grid; grid-template-columns: 120px repeat(7, 160px); gap: 1px; }
              .day-header { background: ${accent}; color: white; padding: 10px; text-align: center; font-weight: bold; }
              .time-header { background: #f8fafc; padding: 10px; text-align: right; font-size: 12px; color: #64748b; }
              .time-slot { background: #f8fafc; border: 1px solid #e5e7eb; height: 48px; }
              .event { background: ${accent}1A; border: 1px solid ${accent}; border-radius: 8px; padding: 8px; margin: 2px; font-size: 12px; }
              .event-title { font-weight: bold; color: ${accent}; }
              .event-time { color: #334155; font-size: 11px; }
              .event-category { color: #475569; font-style: italic; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="planner-container">
              <div class="header">
                <div class="title">${title}</div>
              </div>
              <div class="grid">
                <div class="time-header"></div>
                ${DAYS.map(day => `<div class="day-header">${day}</div>`).join('')}
                ${(denseHours ? Array.from({ length: HOURS.length * 2 }, (_, i) => 7 + i * 0.5) : HOURS).map(h => `
                  <div class="time-slot" style="display: flex; align-items: center; justify-content: flex-end; padding-right: 8px;">
                    <span style="font-size: 12px; color: #64748b;">${formatHour(h)}</span>
                  </div>
                  ${DAYS.map(day => `<div class="time-slot"></div>`).join('')}
                `).join('')}
              </div>
              <div style="margin-top: 20px;">
                ${sortedEvents.map(event => `
                  <div class="event" style="margin-bottom: 10px;">
                    <div class="event-title">${event.title}</div>
                    <div class="event-time">${event.start} - ${event.end} on ${event.day}</div>
                    ${event.category ? `<div class="event-category">${event.category}</div>` : ''}
                    ${event.notes ? `<div style="color: #475569; font-size: 11px; margin-top: 4px;">${event.notes}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          </body>
          </html>
        `;
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    } else {
      Alert.alert('Not supported', 'Print is available on web.');
    }
  }

  const rowHeight = 48;

  return (
    <View style={[styles.screen, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <View style={styles.photoAndTitle}>
          <Pressable onPress={handlePhotoUpload} style={[styles.photoWrapper, { borderColor: accent }]}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}><Text style={{ color: '#94a3b8' }}>Tap to add photo</Text></View>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Kids Weekly Planner"
              style={[styles.titleInput]}
            />
            <View style={styles.controlsRow}>
              <Pressable style={[styles.chip, { backgroundColor: accent }]} onPress={handleAdd}>
                <Text style={styles.chipText}>Add Event</Text>
              </Pressable>
              <Pressable style={styles.chipOutline} onPress={exportCSV}>
                <Text style={styles.chipOutlineText}>Export CSV</Text>
              </Pressable>
              {Platform.OS === 'web' && (
                <Pressable
                  style={styles.chipOutline}
                  onPress={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.csv,text/csv';
                    input.onchange = (e: any) => {
                      const f: File | undefined = e.target?.files?.[0];
                      if (f) importCSVWeb(f);
                    };
                    input.click();
                  }}
                >
                  <Text style={styles.chipOutlineText}>Import CSV</Text>
                </Pressable>
              )}
              <Pressable style={styles.chipOutline} onPress={printPDF}>
                <Text style={styles.chipOutlineText}>Print / PDF</Text>
              </Pressable>
            </View>
            <View style={styles.controlsRow}>
              <Text style={styles.label}>Half-hour rows</Text>
              <Switch value={denseHours} onValueChange={setDenseHours} />
            </View>
            <View style={[styles.controlsRow, { marginTop: 6 }]}>
              <Text style={styles.label}>Accent</Text>
              <View style={styles.colorRow}>
                {['#2563eb','#ef4444','#22c55e','#06b6d4','#f59e0b','#8b5cf6','#14b8a6','#e11d48'].map(c => (
                  <Pressable key={c} onPress={() => setAccent(c)} style={[styles.colorDot, { backgroundColor: c, borderColor: c === accent ? '#111827' : '#e5e7eb' }]} />
                ))}
              </View>
            </View>
            <View style={[styles.controlsRow, { marginTop: 6 }]}>
              <Text style={styles.label}>Background</Text>
              <View style={styles.colorRow}>
                {['#f8fafc','#fef2f2','#f0fdf4','#f0f9ff','#fffbeb','#faf5ff','#f0fdfa','#fef7f7'].map(c => (
                  <Pressable key={c} onPress={() => setBgColor(c)} style={[styles.colorDot, { backgroundColor: c, borderColor: c === bgColor ? '#111827' : '#e5e7eb' }]} />
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView horizontal>
          <View>
            {/* Header row */}
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 120 }} />
              {DAYS.map(d => (
                <View key={d} style={[styles.cellHeader, { width: 160 }]}>
                  <Text style={styles.headerText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Time + grid */}
            <View style={{ flexDirection: 'row' }}>
              {/* Time labels */}
              <View style={{ width: 120 }}>
                {(denseHours ? Array.from({ length: HOURS.length * 2 }, (_, i) => 7 + i * 0.5) : HOURS).map((h, idx) => (
                  <View key={idx} style={{ height: rowHeight, justifyContent: 'flex-start', alignItems: 'flex-end', paddingRight: 8 }}>
                    <Text style={{ color: '#64748b', fontSize: 12, transform: [{ translateY: -8 }] }}>{formatHour(h)}</Text>
                  </View>
                ))}
              </View>

              {/* Columns */}
              <View>
                {/* Background grid */}
                {(denseHours ? Array.from({ length: HOURS.length * 2 }) : HOURS).map((_, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: 'row' }}>
                    {DAYS.map(day => (
                      <View key={`${day}-${rowIdx}`} style={[styles.cell, { width: 160, height: rowHeight }]} />
                    ))}
                  </View>
                ))}

                {/* Events layer */}
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {DAYS.map(day => (
                      <View key={day} style={{ width: 160, position: 'relative' }}>
                        {sortedEvents.filter(e => e.day === day).map(e => {
                          const top = (timeToRow(e.start)) * rowHeight * (denseHours ? 2 : 1);
                          const height = (timeToRow(e.end) - timeToRow(e.start)) * rowHeight * (denseHours ? 2 : 1);
                          return (
                            <Pressable
                              key={e.id}
                              onLongPress={() => { setEditing(e); setOpen(true); }}
                              onPress={() => { setEditing(e); setOpen(true); }}
                              style={({ pressed }) => [
                                styles.eventBlock,
                                { top, height, borderColor: e.color, backgroundColor: e.color + '1A' },
                                pressed && { opacity: 0.85 }
                              ]}
                            >
                              <View style={styles.eventHeader}>
                                <Text style={[styles.eventTitle, { color: e.color }]} numberOfLines={1}>{e.title}</Text>
                                <Text style={styles.eventEdit}>edit</Text>
                              </View>
                              <Text style={styles.eventMeta}>{e.start} – {e.end}</Text>
                              {!!e.category && <Text style={styles.eventCat} numberOfLines={1}>{e.category}</Text>}
                              {!!e.notes && <Text style={styles.eventNotes} numberOfLines={2}>{e.notes}</Text>}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Add/Edit modal */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing && events.find(e => e.id === editing.id) ? 'Edit Event' : 'Add Event'}</Text>

            {!!editing && (
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={styles.label}>Title</Text>
                  <TextInput value={editing.title} onChangeText={v => setEditing({ ...editing, title: v })} placeholder="e.g., School, Football, Piano" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.label}>Day</Text>
                  <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                    {DAYS.map(d => (
                      <Pressable key={d} onPress={() => setEditing({ ...editing, day: d })} style={[styles.dayPill, { backgroundColor: editing.day === d ? accent : '#fff', borderColor: '#e5e7eb' }]}>
                        <Text style={{ color: editing.day === d ? '#fff' : '#111827' }}>{d.slice(0,3)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View>
                  <Text style={styles.label}>Category</Text>
                  <TextInput value={editing.category} onChangeText={v => setEditing({ ...editing, category: v })} placeholder="School / Sport / Rest..." style={styles.input} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Start (HH:MM)</Text>
                    <TextInput value={editing.start} onChangeText={v => setEditing({ ...editing, start: v })} placeholder="09:00" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>End (HH:MM)</Text>
                    <TextInput value={editing.end} onChangeText={v => setEditing({ ...editing, end: v })} placeholder="10:00" style={styles.input} />
                  </View>
                </View>
                <View>
                  <Text style={styles.label}>Color</Text>
                  <View style={styles.colorRow}>
                    {['#2563eb','#ef4444','#22c55e','#06b6d4','#f59e0b','#8b5cf6','#14b8a6','#e11d48'].map(c => (
                      <Pressable key={c} onPress={() => setEditing({ ...editing!, color: c })} style={[styles.colorDot, { backgroundColor: c, borderColor: editing.color === c ? '#111827' : '#e5e7eb' }]} />
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput value={editing.notes ?? ''} onChangeText={v => setEditing({ ...editing, notes: v })} placeholder="Snacks, pickup time, coach name…" style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Pressable onPress={() => setOpen(false)} style={[styles.btn, { backgroundColor: '#e5e7eb' }]}><Text>Cancel</Text></Pressable>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {!!editing?.id && (
                      <Pressable onPress={() => { if (editing?.id) deleteEvent(editing.id); setOpen(false); }} style={[styles.btn, { backgroundColor: '#ef4444' }]}>
                        <Text style={{ color: '#fff' }}>Delete</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={saveEvent} style={[styles.btn, { backgroundColor: accent }]}><Text style={{ color: '#fff' }}>Save</Text></Pressable>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  header: { padding: 12, borderRadius: 12, backgroundColor: '#fff', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  photoAndTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoWrapper: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', borderWidth: 2, backgroundColor: '#fff' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  titleInput: { fontSize: 22, fontWeight: '600', paddingVertical: 6, paddingHorizontal: 0 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { color: '#fff', fontWeight: '600' },
  chipOutline: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipOutlineText: { color: '#0f172a' },
  label: { color: '#475569', fontSize: 13 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorDot: { width: 22, height: 22, borderRadius: 999, borderWidth: 2 },
  body: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cellHeader: { paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  headerText: { fontWeight: '600' },
  cell: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc' },
  eventBlock: { position: 'absolute', left: 4, right: 4, borderRadius: 12, borderWidth: 1, padding: 8, backgroundColor: '#0000000D' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontWeight: '700', fontSize: 12 },
  eventEdit: { fontSize: 11, textDecorationLine: 'underline', color: '#334155' },
  eventMeta: { marginTop: 2, color: '#334155' },
  eventCat: { marginTop: 2, fontStyle: 'italic', color: '#475569' },
  eventNotes: { marginTop: 4, color: '#475569' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: '#111827' },
  dayPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 }
});

