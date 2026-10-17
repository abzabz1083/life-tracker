import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ActionButton, Card, Divider, EmptyState, Field, Page, PageHeading, SectionTitle } from "../../src/components/primitives";
import { makeId, useLife } from "../../src/state/LifeContext";
import { useColors } from "../../hooks/useColors";

export default function StudyScreen() {
  const { data, update } = useLife();
  const colors = useColors();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const groups = useMemo(() => {
    const map = new Map<string, typeof data.modules>();
    for (const module of data.modules) {
      map.set(module.category, [...(map.get(module.category) ?? []), module]);
    }
    return [...map.entries()];
  }, [data.modules]);

  const addModule = () => {
    const categoryName = category.trim() || "General";
    const moduleTitle = title.trim();
    if (!moduleTitle) return;
    const moduleNumber = data.modules
      .filter((module) => module.category.toLowerCase() === categoryName.toLowerCase())
      .reduce((highest, module) => Math.max(highest, module.moduleNumber), 0) + 1;
    update("modules", [{
      id: makeId(),
      category: categoryName,
      title: moduleTitle,
      moduleNumber,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    }, ...data.modules]);
    setTitle("");
    setNotes("");
  };

  return (
    <Page>
      <PageHeading eyebrow="Learning library" title="Keep what you learn." subtitle="A growing shelf of your daily modules, organized by subject." />
      <Card>
        <SectionTitle>Add a module</SectionTitle>
        <Field label="Category" value={category} onChangeText={setCategory} placeholder="Design, finance, languages…" />
        <Field label="Module name" value={title} onChangeText={setTitle} placeholder="What did you study today?" />
        <Field label="Notes and takeaways" value={notes} onChangeText={setNotes} placeholder="Capture the ideas you want to remember." multiline />
        <ActionButton label="Save module" icon="plus" onPress={addModule} disabled={!title.trim()} testID="add-module" />
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Modules are numbered automatically within each category.</Text>
      </Card>

      <Card>
        <SectionTitle detail={`${data.modules.length} saved`}>Your library</SectionTitle>
        {groups.length ? groups.map(([group, modules]) => (
          <View key={group} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={[styles.groupTitle, { color: colors.foreground }]}>{group}</Text>
              <Text style={[styles.groupCount, { color: colors.mutedForeground }]}>{modules.length} {modules.length === 1 ? "module" : "modules"}</Text>
            </View>
            {modules.sort((a, b) => b.moduleNumber - a.moduleNumber).map((module) => (
              <View key={module.id} style={[styles.moduleRow, { borderTopColor: colors.border }]}>
                <View style={[styles.numberBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.numberText, { color: colors.foreground }]}>{String(module.moduleNumber).padStart(2, "0")}</Text>
                </View>
                <View style={styles.moduleCopy}>
                  <Text style={[styles.moduleTitle, { color: colors.foreground }]}>{module.title}</Text>
                  <Text style={[styles.moduleDate, { color: colors.mutedForeground }]}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(module.createdAt))}</Text>
                  {module.notes ? <Text style={[styles.moduleNotes, { color: colors.mutedForeground }]}>{module.notes}</Text> : null}
                </View>
                <Pressable onPress={() => update("modules", data.modules.filter((item) => item.id !== module.id))} accessibilityLabel={`Delete ${module.title}`} style={styles.remove}>
                  <Text style={{ color: colors.mutedForeground }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )) : <EmptyState title="Your first module starts here" detail="Add a subject and name. The tracker will number each module for you." />}
      </Card>
      <Card>
        <SectionTitle>Study rhythm</SectionTitle>
        {data.modules.length ? (
          <>
            <Text style={[styles.bigStat, { color: colors.foreground }]}>{data.modules.length}</Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>modules captured across {new Set(data.modules.map((item) => item.category)).size} {new Set(data.modules.map((item) => item.category)).size === 1 ? "subject" : "subjects"}</Text>
          </>
        ) : <Text style={[styles.helper, { color: colors.mutedForeground }]}>Your study totals will build as you save modules.</Text>}
        <Divider />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  helper: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17, marginTop: 10 },
  group: { marginBottom: 9 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9 },
  groupTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  groupCount: { fontFamily: "Inter_400Regular", fontSize: 11 },
  moduleRow: { flexDirection: "row", gap: 11, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, paddingBottom: 7, alignItems: "flex-start" },
  numberBadge: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  numberText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  moduleCopy: { flex: 1 },
  moduleTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 19 },
  moduleDate: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 3 },
  moduleNotes: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 7 },
  remove: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  bigStat: { fontFamily: "Inter_700Bold", fontSize: 28 },
});
