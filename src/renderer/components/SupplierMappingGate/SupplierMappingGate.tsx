import { useMemo, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Building2, ChevronDown, Minus, type LucideIcon } from "lucide-react";
import { MAX_PROPERTIES_PER_RUN } from "@shared/constants";
import {
  applyGroupSelection,
  countIncludedMappings,
  defaultCollapsedMappingGroupIds,
  isMappingReviewed,
  selectableInGroup,
  sortMappingGroupsForDisplay,
} from "@shared/mappingSelection";
import type {
  PropertyMappingGroup,
  Supplier,
  SupplierMapping,
} from "@shared/types";
import {
  finalizeMappings,
  flattenMappingGroups,
  rankPeCatalogForDetection,
} from "@shared/supplierMatching";

interface Props {
  anchorTerm: string;
  contractFormPropertyTerm: string;
  peCatalog: Supplier[];
  groups: PropertyMappingGroup[];
  unmatchedPe: Supplier[];
  reviewedPeIds: number[];
  batchNumber?: number;
  onGroupsChange: (groups: PropertyMappingGroup[]) => void;
  onContinue: (mappings: SupplierMapping[]) => void;
  onCancel: () => void;
}

export function SupplierMappingGate({
  anchorTerm,
  contractFormPropertyTerm,
  peCatalog,
  groups,
  unmatchedPe,
  reviewedPeIds,
  batchNumber = 1,
  onGroupsChange,
  onContinue,
  onCancel,
}: Props) {
  const [localGroups, setLocalGroups] = useState(groups);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() =>
    defaultCollapsedMappingGroupIds(groups),
  );
  const reviewedSet = useMemo(() => new Set(reviewedPeIds), [reviewedPeIds]);
  const groupStructureKey = useMemo(
    () => groups.map((g) => g.id).join("\0"),
    [groups],
  );

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  useEffect(() => {
    setCollapsedGroupIds(defaultCollapsedMappingGroupIds(groups));
  }, [groupStructureKey, groups]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const flatMappings = useMemo(
    () => flattenMappingGroups(localGroups),
    [localGroups],
  );
  const displayGroups = useMemo(
    () => sortMappingGroupsForDisplay(localGroups),
    [localGroups],
  );
  const includedCount = countIncludedMappings(flatMappings);
  const remainingSlots = MAX_PROPERTIES_PER_RUN - includedCount;
  const canContinue =
    includedCount >= 1 && includedCount <= MAX_PROPERTIES_PER_RUN;

  const stats = useMemo(() => {
    const propertyRows = flatMappings;
    const matched = propertyRows.filter((m) => m.peSupplier);
    const included = propertyRows.filter((m) => m.included && m.peSupplier);
    const reviewed = propertyRows.filter((m) =>
      isMappingReviewed(m, reviewedSet),
    );
    const needsReview = included.filter(
      (m) => m.confidence === "low" || m.confidence === "medium",
    );
    return {
      catalog: peCatalog.length,
      properties: propertyRows.length,
      matched: matched.length,
      included: included.length,
      reviewed: reviewed.length,
      needsReview: needsReview.length,
    };
  }, [flatMappings, peCatalog.length, reviewedSet]);

  const updateGroups = useCallback(
    (next: PropertyMappingGroup[]) => {
      setLocalGroups(next);
      onGroupsChange(next);
    },
    [onGroupsChange],
  );

  const updateProperty = (
    groupId: string,
    propertyKey: string,
    patch: Partial<SupplierMapping>,
  ) => {
    if (patch.included === true) {
      const mapping = flatMappings.find(
        (m) => m.detected?.extractedName === propertyKey,
      );
      if (mapping && !mapping.contractFormMatch) {
        toast.error(
          "Only the property on the uploaded contract form can be selected.",
        );
        return;
      }
      if (mapping && isMappingReviewed(mapping, reviewedSet)) {
        toast.error("This property was already reviewed in a previous batch.");
        return;
      }
      if (remainingSlots <= 0) {
        toast.error(`Maximum ${MAX_PROPERTIES_PER_RUN} properties per batch.`);
        return;
      }
    }

    updateGroups(
      localGroups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              mappings: group.mappings.map((mapping) =>
                mapping.detected?.extractedName !== propertyKey
                  ? mapping
                  : { ...mapping, ...patch },
              ),
            },
      ),
    );
  };

  const toggleGroupIncluded = (groupId: string, included: boolean) => {
    const group = localGroups.find((g) => g.id === groupId);
    if (!group) return;

    const selectable = selectableInGroup(group, reviewedSet);

    if (included) {
      if (selectable.length === 0) return;

      if (remainingSlots <= 0) {
        toast.error(`Maximum ${MAX_PROPERTIES_PER_RUN} properties per batch.`);
        return;
      }

      const before = countIncludedMappings(flattenMappingGroups(localGroups));
      const updated = applyGroupSelection(group, true, reviewedSet, before);
      const added =
        countIncludedMappings(updated.mappings) -
        countIncludedMappings(group.mappings.filter((m) => m.included));

      updateGroups(localGroups.map((g) => (g.id === groupId ? updated : g)));

      if (selectable.length > MAX_PROPERTIES_PER_RUN) {
        toast.message(
          `Selected ${countIncludedMappings(updated.mappings)} of ${selectable.length} properties`,
          {
            description: `Up to ${MAX_PROPERTIES_PER_RUN} properties per batch.`,
          },
        );
      } else if (added > 0 && before + added >= MAX_PROPERTIES_PER_RUN) {
        toast.message(
          `Batch limit reached (${MAX_PROPERTIES_PER_RUN} properties).`,
        );
      }
      return;
    }

    updateGroups(
      localGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              mappings: g.mappings.map((m) => ({ ...m, included: false })),
            }
          : g,
      ),
    );
  };

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(finalizeMappings(flatMappings));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-3">
        <StatusCallout
          variant="info"
          icon={Building2}
          title={`Supplier mapping — ${anchorTerm}`}
          description={`Batch ${batchNumber} · Contract form: ${contractFormPropertyTerm || "—"} · PE catalog: ${stats.catalog} · Properties: ${stats.properties} · Reviewed: ${stats.reviewed} · Selected: ${stats.included} / ${MAX_PROPERTIES_PER_RUN} · Needs review: ${stats.needsReview}`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div className="flex flex-col gap-4">
          {displayGroups.map((group) => (
            <PropertyGroupCard
              key={group.id}
              group={group}
              peCatalog={peCatalog}
              reviewedPeIds={reviewedSet}
              remainingSlots={remainingSlots}
              collapsed={collapsedGroupIds.has(group.id)}
              onToggleCollapse={() => toggleGroupCollapse(group.id)}
              onToggleGroup={(included) =>
                toggleGroupIncluded(group.id, included)
              }
              onPropertyChange={(propertyKey, patch) =>
                updateProperty(group.id, propertyKey, patch)
              }
            />
          ))}

          {unmatchedPe.length > 0 && (
            <details className="group rounded-lg border border-border/40 bg-muted/20 px-4 py-3 opacity-55">
              <summary className="cp-disclosure-summary flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground/70">
                <ChevronDown
                  className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
                <span>
                  {unmatchedPe.length} PE suppliers not detected in PDF
                  (informational)
                </span>
              </summary>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {unmatchedPe.map((pe) => (
                  <li key={pe.supplier_id}>{pe.name}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-background pt-4">
        <Button variant="outline" onClick={onCancel}>
          Start over
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue}>
          {includedCount <= 1
            ? "Continue"
            : `Review ${includedCount} properties`}
        </Button>
      </div>
    </div>
  );
}

function PropertyGroupCard({
  group,
  peCatalog,
  reviewedPeIds,
  remainingSlots,
  collapsed,
  onToggleCollapse,
  onToggleGroup,
  onPropertyChange,
}: {
  group: PropertyMappingGroup;
  peCatalog: Supplier[];
  reviewedPeIds: ReadonlySet<number>;
  remainingSlots: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleGroup: (included: boolean) => void;
  onPropertyChange: (
    propertyKey: string,
    patch: Partial<SupplierMapping>,
  ) => void;
}) {
  const selectable = selectableInGroup(group, reviewedPeIds);
  const includedSelectable = selectable.filter((m) => m.included);
  const allIncluded =
    selectable.length > 0 && includedSelectable.length === selectable.length;
  const someIncluded = includedSelectable.length > 0 && !allIncluded;
  const selectedCount = group.mappings.filter((m) => m.included).length;
  const groupExceedsBatchLimit = selectable.length > MAX_PROPERTIES_PER_RUN;
  const parentSelectBlocked =
    selectable.length === 0 ||
    (remainingSlots <= 0 && includedSelectable.length === 0);
  const contractFormMappings = group.mappings.filter(
    (m) => m.contractFormMatch,
  );
  const otherMappings = group.mappings.filter((m) => !m.contractFormMatch);
  const hasContractFormMatch = contractFormMappings.length > 0;

  return (
    <section
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        selectedCount > 0 &&
          hasContractFormMatch &&
          "border-emerald-500/70 ring-1 ring-emerald-500/25",
        !hasContractFormMatch && "border-border/40 bg-muted/20 opacity-60",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3 bg-muted/25 px-4 py-3",
          !collapsed && "border-b border-border/70",
        )}
      >
        <ParentCheckbox
          checked={allIncluded}
          indeterminate={someIncluded}
          disabled={parentSelectBlocked}
          onCheckedChange={(checked) => onToggleGroup(checked === true)}
          aria-label={`Select properties under ${group.parentName}`}
        />
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${group.parentName}`}
        >
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              collapsed && "-rotate-90",
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={cn(
                  "font-heading text-sm font-semibold",
                  !hasContractFormMatch && "text-muted-foreground",
                )}
              >
                {group.parentName}
              </h3>
              <Badge variant="secondary">
                {group.mappings.length} properties
              </Badge>
              {selectedCount > 0 && (
                <Badge variant="outline">{selectedCount} selected</Badge>
              )}
              <ConfidenceBadge confidence={group.parentConfidence} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {collapsed
                ? "Collapsed — expand to review individual properties."
                : hasContractFormMatch && otherMappings.length > 0
                  ? "Contract form property shown — other properties are collapsed below."
                  : groupExceedsBatchLimit
                    ? `Select individually or use parent checkbox to fill up to ${MAX_PROPERTIES_PER_RUN} per batch.`
                    : "Check parent to select all mapped properties, or choose individually below."}
            </p>
          </div>
        </button>
      </div>

      {!collapsed && (
        <>
          <PropertyMappingList
            groupId={group.id}
            mappings={
              hasContractFormMatch ? contractFormMappings : group.mappings
            }
            peCatalog={peCatalog}
            reviewedPeIds={reviewedPeIds}
            remainingSlots={remainingSlots}
            onPropertyChange={onPropertyChange}
          />

          {hasContractFormMatch && otherMappings.length > 0 && (
            <details className="group border-t border-border/40 bg-muted/25 opacity-60">
              <summary className="cp-disclosure-summary flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground/80 hover:text-muted-foreground">
                <ChevronDown
                  className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
                <span>
                  {otherMappings.length} other propert
                  {otherMappings.length === 1 ? "y" : "ies"} (not on contract
                  form)
                </span>
              </summary>
              <PropertyMappingList
                groupId={group.id}
                mappings={otherMappings}
                peCatalog={peCatalog}
                reviewedPeIds={reviewedPeIds}
                remainingSlots={remainingSlots}
                onPropertyChange={onPropertyChange}
              />
            </details>
          )}
        </>
      )}
    </section>
  );
}

function PropertyMappingList({
  groupId,
  mappings,
  peCatalog,
  reviewedPeIds,
  remainingSlots,
  onPropertyChange,
}: {
  groupId: string;
  mappings: SupplierMapping[];
  peCatalog: Supplier[];
  reviewedPeIds: ReadonlySet<number>;
  remainingSlots: number;
  onPropertyChange: (
    propertyKey: string,
    patch: Partial<SupplierMapping>,
  ) => void;
}) {
  return (
    <ul className="divide-y divide-border/60" role="list">
      {mappings.map((mapping) => {
        const propertyName = mapping.detected?.extractedName ?? "—";
        const rankedPe = rankPeCatalogForDetection(mapping.detected, peCatalog);
        const reviewed = isMappingReviewed(mapping, reviewedPeIds);
        const blockedByContractForm = !mapping.contractFormMatch;
        const atCap = remainingSlots <= 0 && !mapping.included;
        const rowDisabled =
          !mapping.peSupplier || reviewed || atCap || blockedByContractForm;
        const isSelected = mapping.included && mapping.peSupplier != null;
        const isDull = blockedByContractForm || (rowDisabled && !isSelected);

        return (
          <li
            key={propertyName}
            className={cn(
              "px-4 py-3 transition-colors",
              isSelected && !blockedByContractForm && "  bg-emerald-50/50",
              isDull && "bg-muted/30 opacity-45 saturate-50",
            )}
            role="listitem"
          >
            <div className="flex flex-wrap items-start gap-3">
              <Checkbox
                checked={mapping.included}
                disabled={rowDisabled}
                onCheckedChange={(checked) =>
                  onPropertyChange(propertyName, { included: checked === true })
                }
                aria-label={`Include ${propertyName}`}
              />

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDull ? "text-muted-foreground/70" : "text-foreground",
                    )}
                  >
                    {propertyName}
                  </span>
                  {reviewed && (
                    <Badge
                      variant="secondary"
                      className={cn(isDull && "opacity-70")}
                    >
                      Reviewed
                    </Badge>
                  )}
                  {blockedByContractForm && (
                    <Badge
                      variant="outline"
                      className="border-border/50 text-muted-foreground/70"
                    >
                      Not on contract form
                    </Badge>
                  )}
                  <ConfidenceBadge
                    confidence={mapping.confidence}
                    dull={isDull}
                  />
                  {!mapping.peSupplier && (
                    <Badge variant="destructive">
                      No PE match — pick manually
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={`pe-select-${groupId}-${propertyName}`}
                    className={cn(
                      "text-xs font-medium shrink-0",
                      isDull
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground",
                    )}
                  >
                    PE supplier
                  </label>
                  <select
                    id={`pe-select-${groupId}-${propertyName}`}
                    className={cn(
                      "cp-native-select h-8 min-w-[260px] max-w-full flex-1 rounded-md border pl-2 text-sm",
                      isDull
                        ? "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/60"
                        : "border-input bg-background",
                      "disabled:cursor-not-allowed disabled:opacity-100",
                    )}
                    value={mapping.peSupplier?.supplier_id ?? ""}
                    disabled={reviewed || blockedByContractForm}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const supplier = peCatalog.find(
                        (s) => s.supplier_id === id,
                      );
                      if (!supplier) return;
                      onPropertyChange(propertyName, {
                        peSupplier: supplier,
                        matchStatus: "matched",
                        confidence: "manual",
                        included: mapping.contractFormMatch,
                      });
                    }}
                  >
                    <option value="">Select PE supplier…</option>
                    {rankedPe.map((s, index) => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {index === 0 &&
                        mapping.peSupplier?.supplier_id === s.supplier_id
                          ? `★ ${s.name} (${s.code})`
                          : `${s.name} (${s.code})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ParentCheckbox({
  checked,
  indeterminate,
  disabled,
  onCheckedChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!(checked && !indeterminate))}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        disabled && "cursor-not-allowed opacity-40",
        (checked || indeterminate) &&
          "border-primary bg-primary text-primary-foreground",
      )}
    >
      {indeterminate ? (
        <Minus className="size-3.5" aria-hidden="true" />
      ) : checked ? (
        <span className="text-[10px] font-bold" aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function ConfidenceBadge({
  confidence,
  dull = false,
}: {
  confidence: SupplierMapping["confidence"];
  dull?: boolean;
}) {
  const variant =
    confidence === "high" || confidence === "manual"
      ? "default"
      : confidence === "medium"
        ? "secondary"
        : "outline";
  return (
    <Badge
      variant={variant}
      className={cn(
        dull && "opacity-60 border-border/40 text-muted-foreground",
      )}
    >
      {confidence}
    </Badge>
  );
}

function StatusCallout({
  variant,
  icon: Icon,
  title,
  description,
}: {
  variant: "info" | "success" | "destructive";
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3",
        variant === "info" && "border-accent/60 bg-accent/20",
        variant === "success" && "border-emerald-200/80 bg-emerald-50/90",
        variant === "destructive" && "border-destructive/25 bg-destructive/5",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          variant === "info" && "text-primary",
          variant === "success" && "text-emerald-700",
          variant === "destructive" && "text-destructive",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold leading-none text-foreground">
          {title}
        </p>
        <p className="text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
