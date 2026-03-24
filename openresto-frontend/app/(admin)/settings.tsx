import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import {
  fetchRestaurants,
  updateRestaurant,
  addSection,
  updateSection,
  deleteSection,
  addTable,
  updateTable,
  deleteTable,
  RestaurantDto,
  SectionDto,
  TableDto,
} from "@/api/restaurants";
import { getPvqStatus, setupPvq, changePassword, PvqStatus } from "@/api/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import ConfirmModal from "@/components/common/ConfirmModal";
import {
  getEmailSettings,
  saveEmailSettings,
  testEmailConnection,
  saveBrandSettings,
} from "@/api/admin";
import { useBrand } from "@/context/BrandContext";

function useConfirm() {
  const [state, setState] = useState<{ message: string } | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  }, []);

  return { state, confirm, handleConfirm, handleCancel };
}

// ── Inline editable row ──────────────────────────────────────────────────────

function EditableRow({
  value,
  onSave,
  onDelete,
  placeholder,
  deleteLabel = "Delete",
  isDark,
  confirmAction,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  placeholder?: string;
  deleteLabel?: string;
  isDark: boolean;
  confirmAction: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  if (!editing) {
    return (
      <View style={[styles.editableRow, { borderBottomColor: borderColor }]}>
        <ThemedText style={styles.editableValue}>{value}</ThemedText>
        <View style={styles.rowActions}>
          <Pressable
            style={styles.smallBtn}
            onPress={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <ThemedText style={[styles.smallBtnText, { color: PRIMARY }]}>Edit</ThemedText>
          </Pressable>
          {onDelete && (
            <Pressable
              style={styles.smallBtn}
              onPress={async () => {
                const ok = await confirmAction(`Delete "${value}"? This cannot be undone.`);
                if (ok) await onDelete();
              }}
            >
              <ThemedText style={styles.deleteText}>{deleteLabel}</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.editableRow, { borderBottomColor: borderColor }]}>
      <Input
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        style={styles.editableInput}
      />
      <View style={styles.rowActions}>
        <Pressable
          style={styles.smallBtn}
          disabled={saving}
          onPress={async () => {
            if (!draft.trim()) return;
            setSaving(true);
            await onSave(draft.trim());
            setSaving(false);
            setEditing(false);
          }}
        >
          <ThemedText style={[styles.smallBtnText, { color: PRIMARY }]}>
            {saving ? "…" : "Save"}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.smallBtn} onPress={() => setEditing(false)}>
          <ThemedText style={[styles.smallBtnText, { color: MUTED_LIGHT }]}>Cancel</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// ── Add row ──────────────────────────────────────────────────────────────────

function AddRow({
  label,
  placeholder,
  onAdd,
  extraPlaceholder,
}: {
  label: string;
  placeholder?: string;
  onAdd: (name: string, extra?: string) => Promise<void>;
  extraPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Pressable style={styles.addBtn} onPress={() => setOpen(true)}>
        <Ionicons name="add-circle-outline" size={16} color={PRIMARY} />
        <ThemedText style={[styles.addBtnText, { color: PRIMARY }]}>{label}</ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.addForm}>
      <Input value={name} onChangeText={setName} placeholder={placeholder ?? "Name"} />
      {extraPlaceholder && (
        <Input
          value={extra}
          onChangeText={setExtra}
          placeholder={extraPlaceholder}
          keyboardType="numeric"
        />
      )}
      <View style={styles.rowActions}>
        <Button
          onPress={async () => {
            if (!name.trim()) return;
            setSaving(true);
            await onAdd(name.trim(), extra || undefined);
            setSaving(false);
            setName("");
            setExtra("");
            setOpen(false);
          }}
          disabled={saving || !name.trim()}
          style={styles.addSaveBtn}
        >
          {saving ? "Adding…" : "Add"}
        </Button>
        <Pressable
          style={styles.smallBtn}
          onPress={() => {
            setOpen(false);
            setName("");
            setExtra("");
          }}
        >
          <ThemedText style={[styles.smallBtnText, { color: MUTED_LIGHT }]}>Cancel</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────

function TableRow({
  table,
  restaurantId,
  sectionId,
  isDark,
  borderColor,
  onUpdated,
  onDeleted,
  confirmAction,
}: {
  table: TableDto;
  restaurantId: number;
  sectionId: number;
  isDark: boolean;
  borderColor: string;
  onUpdated: (t: TableDto) => void;
  onDeleted: () => void;
  confirmAction: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(table.name ?? "");
  const [draftSeats, setDraftSeats] = useState(String(table.seats));
  const [saving, setSaving] = useState(false);
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;

  if (!editing) {
    return (
      <View style={[styles.tableItemRow, { borderBottomColor: borderColor }]}>
        <View style={styles.tableInfo}>
          <ThemedText style={styles.tableName}>{table.name ?? `Table ${table.id}`}</ThemedText>
          <ThemedText style={[styles.tableSeats, { color: mutedColor }]}>
            {table.seats} seats
          </ThemedText>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            style={styles.smallBtn}
            onPress={() => {
              setDraftName(table.name ?? "");
              setDraftSeats(String(table.seats));
              setEditing(true);
            }}
          >
            <ThemedText style={[styles.smallBtnText, { color: PRIMARY }]}>Edit</ThemedText>
          </Pressable>
          <Pressable
            style={styles.smallBtn}
            onPress={async () => {
              const ok = await confirmAction(
                `Delete table "${table.name ?? `Table ${table.id}`}"?`
              );
              if (!ok) return;
              const success = await deleteTable(restaurantId, sectionId, table.id);
              if (success) onDeleted();
            }}
          >
            <ThemedText style={styles.deleteText}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.tableItemRow, { borderBottomColor: borderColor }]}>
      <View style={styles.tableEditFields}>
        <Input
          value={draftName}
          onChangeText={setDraftName}
          placeholder="Name"
          style={styles.flex2}
        />
        <Input
          value={draftSeats}
          onChangeText={setDraftSeats}
          placeholder="Seats"
          keyboardType="numeric"
          style={styles.flex1}
        />
      </View>
      <View style={styles.rowActions}>
        <Pressable
          style={styles.smallBtn}
          disabled={saving}
          onPress={async () => {
            const seats = parseInt(draftSeats, 10);
            if (isNaN(seats) || seats < 1) return;
            setSaving(true);
            const result = await updateTable(restaurantId, sectionId, table.id, {
              name: draftName.trim() || undefined,
              seats,
            });
            setSaving(false);
            if (result) {
              onUpdated(result);
              setEditing(false);
            }
          }}
        >
          <ThemedText style={[styles.smallBtnText, { color: PRIMARY }]}>
            {saving ? "…" : "Save"}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.smallBtn} onPress={() => setEditing(false)}>
          <ThemedText style={[styles.smallBtnText, { color: MUTED_LIGHT }]}>Cancel</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// ── Section block ────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  restaurantId,
  isDark,
  borderColor,
  mutedColor,
  onSectionRenamed,
  onSectionDeleted,
  onTableAdded,
  onTableUpdated,
  onTableDeleted,
  confirmAction,
}: {
  section: SectionDto;
  restaurantId: number;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  confirmAction: (msg: string) => Promise<boolean>;
  onSectionRenamed: (name: string) => void;
  onSectionDeleted: () => void;
  onTableAdded: (t: TableDto) => void;
  onTableUpdated: (t: TableDto) => void;
  onTableDeleted: (id: number) => void;
}) {
  const sectionBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";

  return (
    <View style={[styles.sectionBlock, { borderColor, backgroundColor: sectionBg }]}>
      <EditableRow
        value={section.name}
        placeholder="Section name"
        isDark={isDark}
        deleteLabel="Delete section"
        confirmAction={confirmAction}
        onSave={async (name) => {
          const result = await updateSection(restaurantId, section.id, name);
          if (result) onSectionRenamed(result.name);
        }}
        onDelete={async () => {
          const ok = await confirmAction(`Delete section "${section.name}" and all its tables?`);
          if (!ok) return;
          const success = await deleteSection(restaurantId, section.id);
          if (success) onSectionDeleted();
        }}
      />
      <View style={styles.tableList}>
        {section.tables.length === 0 && (
          <ThemedText style={[styles.emptyNote, { color: mutedColor }]}>No tables yet.</ThemedText>
        )}
        {section.tables.map((t) => (
          <TableRow
            key={t.id}
            table={t}
            restaurantId={restaurantId}
            sectionId={section.id}
            isDark={isDark}
            borderColor={borderColor}
            onUpdated={onTableUpdated}
            onDeleted={() => onTableDeleted(t.id)}
            confirmAction={confirmAction}
          />
        ))}
        <AddRow
          label="Add Table"
          placeholder="e.g. T1, Window Booth"
          extraPlaceholder="Seats (e.g. 4)"
          onAdd={async (name, extra) => {
            const seats = parseInt(extra ?? "2", 10);
            const result = await addTable(restaurantId, section.id, {
              name,
              seats: isNaN(seats) ? 2 : seats,
            });
            if (result) onTableAdded(result);
          }}
        />
      </View>
    </View>
  );
}

// ── Restaurant info form ─────────────────────────────────────────────────────

function RestaurantInfoForm({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
}) {
  const isDark = useColorScheme() === "dark";
  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [openTime, setOpenTime] = useState(restaurant.openTime ?? "09:00");
  const [closeTime, setCloseTime] = useState(restaurant.closeTime ?? "22:00");
  const [openDays, setOpenDays] = useState<number[]>(
    (restaurant.openDays ?? "1,2,3,4,5,6,7").split(",").map(Number)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const toggleDay = (day: number) => {
    setOpenDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const dirty =
    name !== restaurant.name ||
    address !== (restaurant.address ?? "") ||
    openTime !== (restaurant.openTime ?? "09:00") ||
    closeTime !== (restaurant.closeTime ?? "22:00") ||
    openDays.join(",") !== (restaurant.openDays ?? "1,2,3,4,5,6,7");

  return (
    <View style={styles.infoForm}>
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Name</ThemedText>
        <Input value={name} onChangeText={setName} placeholder="Restaurant name" />
      </View>
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Address</ThemedText>
        <Input value={address} onChangeText={setAddress} placeholder="e.g. 123 Main St" />
      </View>
      <View style={styles.hoursRow}>
        <View style={styles.hoursField}>
          <ThemedText style={styles.fieldLabel}>Opens</ThemedText>
          <input
            type="time"
            value={openTime}
            step={900}
            onChange={(e) => e.target.value && setOpenTime(e.target.value)}
            style={hoursInputStyle}
          />
        </View>
        <View style={styles.hoursField}>
          <ThemedText style={styles.fieldLabel}>Closes</ThemedText>
          <input
            type="time"
            value={closeTime}
            step={900}
            onChange={(e) => e.target.value && setCloseTime(e.target.value)}
            style={hoursInputStyle}
          />
        </View>
      </View>
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Open Days</ThemedText>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, i) => {
            const day = i + 1;
            const active = openDays.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: PRIMARY, borderColor: PRIMARY }
                    : { borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" },
                ]}
              >
                <ThemedText
                  style={[styles.dayChipText, active && { color: "#fff" }]}
                >
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Button
        onPress={async () => {
          if (!name.trim()) return;
          setSaving(true);
          const result = await updateRestaurant(restaurant.id, {
            name: name.trim(),
            address: address.trim() || null,
            openTime,
            closeTime,
            openDays: openDays.join(","),
          });
          setSaving(false);
          if (result) {
            onSaved({
              name: result.name,
              address: result.address,
              openTime: result.openTime,
              closeTime: result.closeTime,
              openDays: result.openDays,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }}
        disabled={!dirty || saving || !name.trim()}
        style={styles.saveBtn}
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
      </Button>
    </View>
  );
}

const hoursInputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 8,
  paddingLeft: 12,
  paddingRight: 12,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  cursor: "pointer",
};

// ── Location card ─────────────────────────────────────────────────────────────

function LocationCard({
  restaurant,
  isSelected,
  onSelect,
  onSaved,
  isDark,
  borderColor,
  mutedColor,
  cardBg,
  confirmAction,
}: {
  restaurant: RestaurantDto;
  isSelected: boolean;
  onSelect: () => void;
  onSaved: (patch: Partial<RestaurantDto>) => void;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  confirmAction: (msg: string) => Promise<boolean>;
}) {
  const tableCount = restaurant.sections.reduce((acc, s) => acc + s.tables.length, 0);

  return (
    <View
      style={[
        styles.locationCard,
        { backgroundColor: cardBg, borderColor },
        isSelected && { borderColor: PRIMARY },
      ]}
    >
      {/* Card header */}
      <View style={styles.locationCardHeader}>
        <View style={[styles.locationIcon, { backgroundColor: `${PRIMARY}14` }]}>
          <Ionicons name="storefront-outline" size={22} color={PRIMARY} />
        </View>
        <View style={styles.locationMeta}>
          <ThemedText style={styles.locationName}>{restaurant.name}</ThemedText>
          {restaurant.address ? (
            <ThemedText style={[styles.locationAddress, { color: mutedColor }]} numberOfLines={1}>
              {restaurant.address}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.activeBadge}>
          <ThemedText style={styles.activeBadgeText}>ACTIVE</ThemedText>
        </View>
      </View>

      {/* Stats row */}
      <View style={[styles.locationStats, { borderTopColor: borderColor }]}>
        <View style={styles.locationStat}>
          <ThemedText style={styles.locationStatValue}>{restaurant.sections.length}</ThemedText>
          <ThemedText style={[styles.locationStatLabel, { color: mutedColor }]}>
            Sections
          </ThemedText>
        </View>
        <View style={[styles.locationStatDivider, { backgroundColor: borderColor }]} />
        <View style={styles.locationStat}>
          <ThemedText style={styles.locationStatValue}>{tableCount}</ThemedText>
          <ThemedText style={[styles.locationStatLabel, { color: mutedColor }]}>Tables</ThemedText>
        </View>
        <View style={styles.locationCardAction}>
          <Pressable
            style={[
              styles.configureBtn,
              isSelected ? { backgroundColor: PRIMARY } : { backgroundColor: `${PRIMARY}14` },
            ]}
            onPress={onSelect}
          >
            <Ionicons
              name={isSelected ? "chevron-up" : "settings-outline"}
              size={14}
              color={isSelected ? "#fff" : PRIMARY}
            />
            <ThemedText style={[styles.configureBtnText, { color: isSelected ? "#fff" : PRIMARY }]}>
              {isSelected ? "Close" : "Configure"}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Expanded editor */}
      {isSelected && (
        <View style={[styles.expandedEditor, { borderTopColor: borderColor }]}>
          <ThemedText style={styles.editorSectionTitle}>Restaurant Info</ThemedText>
          <RestaurantInfoForm restaurant={restaurant} onSaved={onSaved} />

          <ThemedText style={[styles.editorSectionTitle, { marginTop: 20 }]}>
            Sections & Tables
          </ThemedText>
          <ThemedText style={[styles.editorSectionSub, { color: mutedColor }]}>
            Manage your dining areas and tables.
          </ThemedText>

          {restaurant.sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              restaurantId={restaurant.id}
              isDark={isDark}
              borderColor={borderColor}
              mutedColor={mutedColor}
              confirmAction={confirmAction}
              onSectionRenamed={(name) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id ? { ...s, name } : s
                  ),
                })
              }
              onSectionDeleted={() =>
                onSaved({
                  sections: restaurant.sections.filter((s) => s.id !== section.id),
                })
              }
              onTableAdded={(t) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id ? { ...s, tables: [...s.tables, t] } : s
                  ),
                })
              }
              onTableUpdated={(t) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id
                      ? {
                          ...s,
                          tables: s.tables.map((x) => (x.id === t.id ? t : x)),
                        }
                      : s
                  ),
                })
              }
              onTableDeleted={(id) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id ? { ...s, tables: s.tables.filter((x) => x.id !== id) } : s
                  ),
                })
              }
            />
          ))}

          <AddRow
            label="Add Section"
            placeholder="e.g. Indoor, Patio, Bar"
            onAdd={async (name) => {
              const result = await addSection(restaurant.id, name);
              if (result)
                onSaved({
                  sections: [...restaurant.sections, { ...result, tables: [] }],
                });
            }}
          />
        </View>
      )}
    </View>
  );
}

// ── Global settings row ───────────────────────────────────────────────────────

function GlobalSettingRow({
  icon,
  title,
  sub,
  mutedColor,
  borderColor,
  cardBg,
  comingSoon,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  sub: string;
  mutedColor: string;
  borderColor: string;
  cardBg: string;
  comingSoon?: boolean;
}) {
  return (
    <Pressable
      style={(state) => [
        styles.globalRow,
        { borderColor, backgroundColor: cardBg },
        !comingSoon && (state as any).hovered && { opacity: 0.85 },
        { cursor: comingSoon ? ("default" as any) : ("pointer" as any) },
      ]}
    >
      <View style={[styles.globalRowIcon, { backgroundColor: `${PRIMARY}14` }]}>
        <Ionicons name={icon} size={18} color={PRIMARY} />
      </View>
      <View style={styles.globalRowText}>
        <ThemedText style={styles.globalRowTitle}>{title}</ThemedText>
        <ThemedText style={[styles.globalRowSub, { color: mutedColor }]}>{sub}</ThemedText>
      </View>
      {comingSoon ? (
        <View style={styles.comingSoonBadge}>
          <ThemedText style={styles.comingSoonText}>Soon</ThemedText>
        </View>
      ) : (
        <Ionicons name="chevron-forward-outline" size={16} color={mutedColor} />
      )}
    </Pressable>
  );
}

// ── Brand settings card ───────────────────────────────────────────────────────

const MAX_LOGO_KB = 256;

function BrandSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const brand = useBrand();
  const [appName, setAppName] = useState(brand.appName);
  const [primaryColor, setPrimaryColor] = useState(brand.primaryColor);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logoUrl ?? null);
  const [logoData, setLogoData] = useState<string | undefined>(undefined); // undefined = no change
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setAppName(brand.appName);
    setPrimaryColor(brand.primaryColor);
    setLogoPreview(brand.logoUrl ?? null);
  }, [brand]);

  const handlePickLogo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_LOGO_KB * 1024) {
        setMsg({
          text: `Logo must be under ${MAX_LOGO_KB} KB. Yours is ${Math.round(file.size / 1024)} KB.`,
          ok: false,
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLogoPreview(dataUrl);
        setLogoData(dataUrl);
        setMsg(null);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const result = await saveBrandSettings({
      appName,
      primaryColor,
      logoBase64: logoData,
    });
    setSaving(false);
    if (result) {
      setMsg({ text: result.message, ok: !result.message.toLowerCase().includes("fail") });
    } else {
      setMsg({ text: "Failed to save.", ok: false });
    }
  };

  const PRESET_COLORS = [
    "#0a7ea4",
    "#2563eb",
    "#7c3aed",
    "#059669",
    "#dc2626",
    "#d97706",
    "#475569",
  ];

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
          <Ionicons name="brush-outline" size={20} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Brand Identity</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            {appName} · {primaryColor}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
      </Pressable>

      {expanded && (
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>App Name</ThemedText>
            <Input value={appName} onChangeText={setAppName} placeholder="Open Resto" />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Primary Color</ThemedText>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setPrimaryColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: primaryColor === c ? 3 : 0,
                    borderColor: "#fff",
                    shadowColor: "#000",
                    shadowOpacity: primaryColor === c ? 0.3 : 0,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                />
              ))}
              <Input
                value={primaryColor}
                onChangeText={setPrimaryColor}
                placeholder="#0a7ea4"
                style={{ width: 100 }}
              />
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Logo (max {MAX_LOGO_KB} KB)</ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {logoPreview ? (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor,
                  }}
                >
                  <img
                    src={logoPreview}
                    alt="Logo"
                    style={{ width: 48, height: 48, objectFit: "contain" }}
                  />
                </View>
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="image-outline" size={20} color={mutedColor} />
                </View>
              )}
              <Pressable style={[styles.secBtn, { borderColor }]} onPress={handlePickLogo}>
                <ThemedText style={[styles.secBtnText, { color: PRIMARY }]}>
                  {logoPreview ? "Change" : "Upload"}
                </ThemedText>
              </Pressable>
              {logoPreview && (
                <Pressable
                  style={[styles.secBtn, { borderColor }]}
                  onPress={() => {
                    setLogoPreview(null);
                    setLogoData("");
                  }}
                >
                  <ThemedText style={[styles.secBtnText, { color: "#dc2626" }]}>Remove</ThemedText>
                </Pressable>
              )}
            </View>
          </View>

          {msg && (
            <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
              {msg.text}
            </ThemedText>
          )}

          <Button
            onPress={handleSave}
            disabled={saving || !appName.trim()}
            style={{ marginTop: 4 }}
          >
            {saving ? "Saving…" : "Save Brand Settings"}
          </Button>

          <ThemedText style={{ fontSize: 12, color: mutedColor, marginTop: 4 }}>
            Changes take effect after a page reload. Logo is stored in the database — no CDN
            required.
          </ThemedText>
        </View>
      )}
    </View>
  );
}

// ── Email settings card ───────────────────────────────────────────────────────

const PRESETS: { label: string; host: string; port: number }[] = [
  { label: "Gmail", host: "smtp.gmail.com", port: 587 },
  { label: "Outlook", host: "smtp-mail.outlook.com", port: 587 },
];

function EmailSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enableSsl, setEnableSsl] = useState(true);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getEmailSettings().then((s) => {
      setHost(s.host);
      setPort(String(s.port));
      setUsername(s.username);
      setPassword(s.password);
      setEnableSsl(s.enableSsl);
      setFromName(s.fromName ?? "");
      setFromEmail(s.fromEmail ?? "");
      setIsConfigured(s.isConfigured);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const result = await saveEmailSettings({
      host,
      port: parseInt(port, 10) || 587,
      username,
      password,
      enableSsl,
      fromName: fromName || undefined,
      fromEmail: fromEmail || undefined,
    });
    setSaving(false);
    if (result) {
      setMsg({ text: result.message, ok: true });
      setIsConfigured(true);
    } else {
      setMsg({ text: "Failed to save.", ok: false });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMsg(null);
    // Save first so the backend tests the latest values
    await saveEmailSettings({
      host,
      port: parseInt(port, 10) || 587,
      username,
      password,
      enableSsl,
      fromName: fromName || undefined,
      fromEmail: fromEmail || undefined,
    });
    setIsConfigured(true);
    const result = await testEmailConnection();
    setTesting(false);
    setMsg({ text: result.message, ok: result.ok });
  };

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: "rgba(10,126,164,0.1)" }]}>
          <Ionicons name="mail-outline" size={20} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Email (SMTP)</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            {isConfigured ? `Connected via ${host}` : "Not configured"}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
      </Pressable>

      {expanded && (
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          {/* Presets */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                style={[styles.secBtn, { borderColor }]}
                onPress={() => {
                  setHost(p.host);
                  setPort(String(p.port));
                  setEnableSsl(true);
                }}
              >
                <ThemedText style={[styles.secBtnText, { color: PRIMARY }]}>{p.label}</ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>SMTP Host</ThemedText>
            <Input value={host} onChangeText={setHost} placeholder="smtp.gmail.com" />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.fieldLabel}>Port</ThemedText>
              <Input value={port} onChangeText={setPort} placeholder="587" keyboardType="numeric" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.fieldLabel}>SSL/TLS</ThemedText>
              <Pressable
                style={[
                  styles.secBtn,
                  { borderColor, paddingVertical: 10, alignItems: "center" as const },
                ]}
                onPress={() => setEnableSsl((v) => !v)}
              >
                <Ionicons
                  name={enableSsl ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={enableSsl ? PRIMARY : mutedColor}
                />
                <ThemedText
                  style={[styles.secBtnText, { color: enableSsl ? PRIMARY : mutedColor }]}
                >
                  {enableSsl ? "Enabled" : "Disabled"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Username</ThemedText>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder="your@email.com"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Password</ThemedText>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="App password or SMTP password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
              <Pressable onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={mutedColor}
                />
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.fieldLabel}>From Name (optional)</ThemedText>
              <Input value={fromName} onChangeText={setFromName} placeholder="OpenResto" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <ThemedText style={styles.fieldLabel}>From Email (optional)</ThemedText>
              <Input
                value={fromEmail}
                onChangeText={setFromEmail}
                placeholder="noreply@yoursite.com"
                autoCapitalize="none"
              />
            </View>
          </View>

          {msg && (
            <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
              {msg.text}
            </ThemedText>
          )}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Button
              onPress={handleSave}
              disabled={saving || !host || !username}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : "Save Settings"}
            </Button>
            <Pressable
              style={[
                styles.secBtn,
                { borderColor, paddingVertical: 10, paddingHorizontal: 14 },
                (!host || !username) && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (testing || !host || !username) return;
                handleTest();
              }}
            >
              {testing ? (
                <ThemedText style={[styles.secBtnText, { color: mutedColor }]}>Testing…</ThemedText>
              ) : (
                <>
                  <Ionicons name="flash-outline" size={14} color={PRIMARY} />
                  <ThemedText style={[styles.secBtnText, { color: PRIMARY }]}>Test</ThemedText>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Security card ─────────────────────────────────────────────────────────────

function SecurityCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const [pvqStatus, setPvqStatus] = useState<PvqStatus | null>(null);
  const [showPvqForm, setShowPvqForm] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [pvqQuestion, setPvqQuestion] = useState("");
  const [pvqAnswer, setPvqAnswer] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getPvqStatus().then(setPvqStatus);
  }, []);

  const handleSavePvq = async () => {
    if (!pvqQuestion.trim() || !pvqAnswer.trim()) return;
    setSaving(true);
    const result = await setupPvq(pvqQuestion.trim(), pvqAnswer.trim());
    setSaving(false);
    setMsg({ text: result.message, ok: result.ok });
    if (result.ok) {
      setPvqStatus({ isConfigured: true, question: pvqQuestion.trim() });
      setShowPvqForm(false);
      setPvqQuestion("");
      setPvqAnswer("");
    }
  };

  const handleChangePw = async () => {
    if (newPw !== confirmPw) {
      setMsg({ text: "Passwords do not match.", ok: false });
      return;
    }
    if (newPw.length < 6) {
      setMsg({ text: "Password must be at least 6 characters.", ok: false });
      return;
    }
    setSaving(true);
    const result = await changePassword(currentPw, newPw);
    setSaving(false);
    setMsg({ text: result.message, ok: result.ok });
    if (result.ok) {
      setShowPwForm(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  };

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.secHeader}>
        <View style={[styles.secIcon, { backgroundColor: `${PRIMARY}14` }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Account Security</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            Manage your password and identity verification
          </ThemedText>
        </View>
      </View>

      {/* PVQ status row */}
      <View style={[styles.secRow, { borderTopColor: borderColor }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText style={styles.secRowTitle}>Security Question</ThemedText>
          {pvqStatus?.isConfigured ? (
            <ThemedText style={[styles.secRowSub, { color: mutedColor }]} numberOfLines={1}>
              {pvqStatus.question}
            </ThemedText>
          ) : (
            <ThemedText style={[styles.secRowSub, { color: "#f59e0b" }]}>
              Not configured — set one up to enable password reset
            </ThemedText>
          )}
        </View>
        <Pressable
          style={[styles.secBtn, { borderColor }]}
          onPress={() => {
            setShowPvqForm((v) => !v);
            setShowPwForm(false);
            setMsg(null);
          }}
        >
          <ThemedText style={[styles.secBtnText, { color: PRIMARY }]}>
            {pvqStatus?.isConfigured ? "Change" : "Set up"}
          </ThemedText>
        </Pressable>
      </View>

      {showPvqForm && (
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Security question</ThemedText>
            <Input
              value={pvqQuestion}
              onChangeText={setPvqQuestion}
              placeholder="e.g. What was the name of your first pet?"
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Answer (not case-sensitive)</ThemedText>
            <Input
              value={pvqAnswer}
              onChangeText={setPvqAnswer}
              placeholder="Your answer"
              autoCapitalize="none"
            />
          </View>
          {msg && !msg.ok && <ThemedText style={styles.errorText}>{msg.text}</ThemedText>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Button
              onPress={handleSavePvq}
              disabled={saving || !pvqQuestion.trim() || !pvqAnswer.trim()}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : "Save Question"}
            </Button>
            <Pressable style={styles.smallBtn} onPress={() => setShowPvqForm(false)}>
              <ThemedText style={[styles.smallBtnText, { color: mutedColor }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Password row */}
      <View style={[styles.secRow, { borderTopColor: borderColor }]}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secRowTitle}>Password</ThemedText>
          <ThemedText style={[styles.secRowSub, { color: mutedColor }]}>
            Change your admin password
          </ThemedText>
        </View>
        <Pressable
          style={[styles.secBtn, { borderColor }]}
          onPress={() => {
            setShowPwForm((v) => !v);
            setShowPvqForm(false);
            setMsg(null);
          }}
        >
          <ThemedText style={[styles.secBtnText, { color: PRIMARY }]}>Change</ThemedText>
        </Pressable>
      </View>

      {showPwForm && (
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Current password</ThemedText>
            <Input
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>New password</ThemedText>
            <Input
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              placeholder="At least 6 characters"
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Confirm new password</ThemedText>
            <Input
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              placeholder="Repeat password"
            />
          </View>
          {msg && (
            <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
              {msg.text}
            </ThemedText>
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Button
              onPress={handleChangePw}
              disabled={saving || !currentPw || newPw.length < 6}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : "Update Password"}
            </Button>
            <Pressable style={styles.smallBtn} onPress={() => setShowPwForm(false)}>
              <ThemedText style={[styles.smallBtnText, { color: mutedColor }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {msg?.ok && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
          <ThemedText style={styles.successText}>{msg.text}</ThemedText>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AdminSettingsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const isDark = useColorScheme() === "dark";
  const { state: confirmState, confirm: confirmAction, handleConfirm, handleCancel } = useConfirm();

  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const cardBg = isDark ? "#1e2022" : "#ffffff";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;

  function patchRestaurant(id: number, patch: Partial<RestaurantDto>) {
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  useEffect(() => {
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <ThemedText style={styles.pageTitle}>Location Manager</ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {restaurants.length} location{restaurants.length !== 1 ? "s" : ""} configured
          </ThemedText>
        </View>
      </View>

      {/* Location cards */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          YOUR LOCATIONS
        </ThemedText>
        {restaurants.map((r) => (
          <LocationCard
            key={r.id}
            restaurant={r}
            isSelected={selectedId === r.id}
            onSelect={() => setSelectedId((prev) => (prev === r.id ? null : r.id))}
            onSaved={(patch) => patchRestaurant(r.id, patch)}
            isDark={isDark}
            borderColor={borderColor}
            mutedColor={mutedColor}
            cardBg={cardBg}
            confirmAction={confirmAction}
          />
        ))}
        {restaurants.length === 0 && (
          <View style={[styles.emptyCard, { borderColor, backgroundColor: cardBg }]}>
            <Ionicons name="storefront-outline" size={32} color={mutedColor} />
            <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
              No locations found
            </ThemedText>
          </View>
        )}
      </View>

      {/* Global Settings */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          GLOBAL SETTINGS
        </ThemedText>
        <BrandSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <EmailSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <GlobalSettingRow
          icon="globe-outline"
          title="API & Network"
          sub="API keys, webhooks, and integrations"
          mutedColor={mutedColor}
          borderColor={borderColor}
          cardBg={cardBg}
          comingSoon
        />
      </View>

      {/* Account Security */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          ACCOUNT SECURITY
        </ThemedText>
        <SecurityCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
      </View>


      <ConfirmModal
        visible={!!confirmState}
        title="Confirm"
        message={confirmState?.message ?? ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    padding: 24,
    paddingTop: 32,
    gap: 28,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  pageSub: {
    fontSize: 14,
    marginTop: 2,
  },
  section: { gap: 10 },
  sectionHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  // Location card
  locationCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  locationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  locationMeta: { flex: 1, gap: 2 },
  locationName: { fontSize: 16, fontWeight: "700" },
  locationAddress: { fontSize: 13 },
  activeBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803d",
    letterSpacing: 0.5,
  },
  locationStats: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 16,
  },
  locationStat: { alignItems: "center", gap: 1 },
  locationStatValue: { fontSize: 20, fontWeight: "800" },
  locationStatLabel: { fontSize: 11 },
  locationStatDivider: { width: 1, height: 28 },
  locationCardAction: { flex: 1, alignItems: "flex-end" },
  configureBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  configureBtnText: { fontSize: 13, fontWeight: "700" },
  expandedEditor: {
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  editorSectionTitle: { fontSize: 15, fontWeight: "700" },
  editorSectionSub: { fontSize: 13, marginTop: -6 },
  // Inline editable rows
  editableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  editableValue: { fontSize: 15, fontWeight: "600", flex: 1 },
  editableInput: { flex: 1 },
  rowActions: { flexDirection: "row", gap: 4 },
  smallBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  smallBtnText: { fontSize: 13, fontWeight: "600" },
  deleteText: { fontSize: 13, fontWeight: "600", color: "#dc2626" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  addForm: { gap: 8, paddingTop: 8 },
  addSaveBtn: { flex: 0 },
  sectionBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  tableList: { paddingLeft: 4, paddingTop: 4 },
  emptyNote: { fontSize: 13, fontStyle: "italic", paddingVertical: 8 },
  tableItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  tableInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  tableName: { fontSize: 14, fontWeight: "500" },
  tableSeats: { fontSize: 12 },
  tableEditFields: { flex: 1, flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  infoForm: { gap: 4 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  hoursRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  hoursField: { flex: 1, gap: 4 },
  dayRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  dayChipText: { fontSize: 13, fontWeight: "600" },
  saveBtn: { marginTop: 8 },
  // Empty card
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 14, fontStyle: "italic" },
  // Global settings rows
  globalRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  globalRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  globalRowText: { flex: 1, gap: 2 },
  globalRowTitle: { fontSize: 15, fontWeight: "600" },
  globalRowSub: { fontSize: 12 },
  comingSoonBadge: {
    backgroundColor: "rgba(10,126,164,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  comingSoonText: { fontSize: 11, fontWeight: "700", color: PRIMARY },
  // Security card
  secCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  secHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  secIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secTitle: { fontSize: 15, fontWeight: "700" },
  secSub: { fontSize: 12, marginTop: 1 },
  secRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  secRowTitle: { fontSize: 14, fontWeight: "600" },
  secRowSub: { fontSize: 12, marginTop: 1 },
  secBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  secBtnText: { fontSize: 13, fontWeight: "600" },
  secForm: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  errorText: { color: "#dc2626", fontSize: 13 },
  successText: { color: "#16a34a", fontSize: 13 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, paddingTop: 0 },
});
