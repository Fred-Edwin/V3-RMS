'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Plus, X } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  FormField,
  IconButton,
  Input,
} from '@/components/ui';
import { ItemCombobox } from '@/components/inventory/ItemCombobox';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import {
  createPrepRecipe,
  listInventoryItems,
  listPrepRecipes,
  updatePrepRecipe,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { InventoryItem, PrepRecipe } from '@/types/inventory';

interface RecipeIngredientLine {
  key: string;
  itemId: string;
  quantity: string;
}

const newLine = (): RecipeIngredientLine => ({ key: crypto.randomUUID(), itemId: '', quantity: '' });

interface RecipeFormState {
  mode: 'new' | PrepRecipe;
  outputItemName: string;
  yieldUnit: string;
  expectedYield: string;
  ingredients: RecipeIngredientLine[];
}

/**
 * Prep Recipes — Manager-only authoring tab (D-12 reopened, see
 * UI_UX_DESIGN_AUDIT.md Flow 3). Creating a recipe here is now the *only*
 * way a PREPPED item comes into existence — it no longer has a path through
 * Item Catalog. Log Prep reads a recipe's lines back as its pre-fill, so
 * authoring a good recipe here directly reduces touches on every future
 * prep run for that item.
 */
export function PrepRecipesTab(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [recipes, setRecipes] = useState<PrepRecipe[]>([]);
  const [rawItems, setRawItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<RecipeFormState | null>(null);

  const load = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [recipeList, itemList] = await Promise.all([
        listPrepRecipes(accessToken),
        listInventoryItems(accessToken, { isActive: true }),
      ]);
      setRecipes(recipeList);
      setRawItems(itemList);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load recipes', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Input lines pick from raw/pass-through items only — a recipe's inputs
  // are what's consumed to produce it, never another prepped item circularly,
  // and never the recipe's own not-yet-created output.
  const inputCandidates = useMemo(() => rawItems.filter((i) => i.type !== 'PREPPED'), [rawItems]);
  const itemsById = useMemo(() => new Map(rawItems.map((i) => [i.id, i])), [rawItems]);

  const openNew = () => {
    setForm({ mode: 'new', outputItemName: '', yieldUnit: '', expectedYield: '', ingredients: [newLine()] });
  };

  const openEdit = (recipe: PrepRecipe) => {
    setForm({
      mode: recipe,
      outputItemName: recipe.name,
      yieldUnit: recipe.outputItem.usageUnit ?? '',
      expectedYield: recipe.expectedYield,
      ingredients: recipe.lines.map((line) => ({ key: line.id, itemId: line.inputItemId, quantity: line.quantity })),
    });
  };

  const closeForm = () => setForm(null);

  const addLine = () => setForm((f) => (f ? { ...f, ingredients: [...f.ingredients, newLine()] } : f));
  const removeLine = (key: string) =>
    setForm((f) => (f ? { ...f, ingredients: f.ingredients.length > 1 ? f.ingredients.filter((l) => l.key !== key) : f.ingredients } : f));
  const updateLine = (key: string, patch: Partial<RecipeIngredientLine>) =>
    setForm((f) => (f ? { ...f, ingredients: f.ingredients.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : f));

  const handleSave = async () => {
    if (!accessToken || !form) return;

    const validLines = form.ingredients.filter((l) => l.itemId && l.quantity && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) {
      toast({ variant: 'error', title: 'Add at least one ingredient', message: 'A recipe needs at least one ingredient.' });
      return;
    }
    if (!form.expectedYield || parseFloat(form.expectedYield) <= 0) {
      toast({ variant: 'error', title: 'Enter the expected yield', message: 'How much does one batch of this recipe produce?' });
      return;
    }

    setIsSaving(true);
    try {
      if (form.mode === 'new') {
        if (!form.outputItemName.trim()) {
          toast({ variant: 'error', title: 'Name required', message: 'Give the prepped item a name.' });
          return;
        }
        if (!form.yieldUnit.trim()) {
          toast({ variant: 'error', title: 'Yield unit required', message: 'e.g. kg, L, pcs' });
          return;
        }
        await createPrepRecipe(
          {
            outputItemName: form.outputItemName.trim(),
            usageUnit: form.yieldUnit.trim(),
            expectedYield: form.expectedYield,
            inputs: validLines.map((l) => ({ inventoryItemId: l.itemId, quantity: l.quantity })),
          },
          accessToken,
        );
        toast({ variant: 'success', title: 'Recipe created', message: `${form.outputItemName.trim()} is now a prepped item.` });
      } else {
        await updatePrepRecipe(
          form.mode.id,
          {
            expectedYield: form.expectedYield,
            inputs: validLines.map((l) => ({ inventoryItemId: l.itemId, quantity: l.quantity })),
          },
          accessToken,
        );
        toast({ variant: 'success', title: 'Recipe updated', message: `${form.outputItemName} recipe saved.` });
      }
      closeForm();
      await load();
    } catch (error) {
      toast({ variant: 'error', title: 'Could not save recipe', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-stone-500">
          Define what a prepped item is made from — Log Prep pre-fills from this recipe every time it&apos;s used.
        </p>
        <Button onClick={openNew} size="sm">
          <Plus size={16} /> New Recipe
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-body-sm text-stone-500">Loading…</Card>
      ) : recipes.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={<ChefHat size={40} />}
            heading="No prep recipes yet"
            body="Create your first recipe to define a prepped item and what it's made from."
            action={<Button onClick={openNew}>Create a Recipe</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, index) => (
            <Card key={recipe.id} className="cursor-pointer space-y-3 p-4 hover:border-espresso/40" onClick={() => openEdit(recipe)}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-md font-semibold tabular-nums text-stone-500">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-semibold text-stone-900">{recipe.name}</p>
                  <p className="text-label-sm text-stone-500">
                    {recipe.lines.length} ingredient{recipe.lines.length === 1 ? '' : 's'} · 1 batch yields {recipe.expectedYield} {recipe.outputItem.usageUnit}
                  </p>
                </div>
              </div>
              <div className="space-y-1 border-t border-stone-100 pt-2">
                {recipe.lines.slice(0, 3).map((line) => (
                  <p key={line.id} className="truncate text-label-sm text-stone-600">
                    {line.inputItem.name} · {line.quantity}
                  </p>
                ))}
                {recipe.lines.length > 3 && (
                  <p className="text-label-sm text-stone-400">+{recipe.lines.length - 3} more</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={closeForm}>
          <div
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <h2 className="text-heading-md font-semibold text-stone-900">
                {form.mode === 'new' ? 'New Prep Recipe' : `Edit ${form.mode.name}`}
              </h2>
              <IconButton icon={<X size={18} />} label="Close" variant="ghost" size="sm" onClick={closeForm} />
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <FormField
                label="Prepped Item Name"
                htmlFor="recipe-output-name"
                required
                helperText={form.mode === 'new' ? 'This creates a new prepped item in the catalog' : undefined}
              >
                <Input
                  id="recipe-output-name"
                  value={form.outputItemName}
                  disabled={form.mode !== 'new'}
                  onChange={(e) => setForm((f) => (f ? { ...f, outputItemName: e.target.value } : f))}
                  placeholder="e.g. Marinated Chicken"
                />
              </FormField>

              <div>
                <p className="mb-2 text-label-md font-medium text-stone-700">Ingredients (one batch)</p>
                <div className="space-y-2">
                  {form.ingredients.map((line) => {
                    const item = itemsById.get(line.itemId);
                    return (
                      <div key={line.key} className="flex items-end gap-2 rounded-md border border-stone-200 bg-white p-2.5">
                        <div className="flex-1">
                          <ItemCombobox
                            items={inputCandidates}
                            value={line.itemId}
                            onChange={(itemId) => updateLine(line.key, { itemId })}
                            placeholder="Select ingredient…"
                          />
                        </div>
                        <QuantityInput
                          value={line.quantity}
                          onValueChange={(v) => updateLine(line.key, { quantity: v })}
                          unit={item?.usageUnit}
                          className="w-40"
                        />
                        {form.ingredients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="shrink-0 p-2 text-stone-400 hover:text-stone-600"
                            aria-label="Remove ingredient"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 py-2.5 text-label-md font-medium text-stone-600 hover:border-espresso hover:text-espresso"
                >
                  <Plus size={16} /> Add another ingredient
                </button>
              </div>

              <div className="rounded-md border border-stone-200 bg-parchment/40 p-4">
                <p className="mb-3 text-label-md font-medium text-stone-700">This batch yields</p>
                <div className="flex gap-3">
                  <FormField label="Expected Yield" htmlFor="recipe-yield" required className="flex-1">
                    <QuantityInput
                      id="recipe-yield"
                      value={form.expectedYield}
                      onValueChange={(v) => setForm((f) => (f ? { ...f, expectedYield: v } : f))}
                      unit={form.mode === 'new' ? form.yieldUnit : form.mode.outputItem.usageUnit}
                    />
                  </FormField>
                  {form.mode === 'new' && (
                    <FormField label="Yield Unit" htmlFor="recipe-yield-unit" required className="w-28" helperText="kg, L, pcs">
                      <Input
                        id="recipe-yield-unit"
                        value={form.yieldUnit}
                        onChange={(e) => setForm((f) => (f ? { ...f, yieldUnit: e.target.value } : f))}
                        placeholder="kg"
                      />
                    </FormField>
                  )}
                </div>
                <p className="mt-2 text-label-sm text-stone-500">
                  How much one full batch of the ingredients above produces — this is what Log Prep pre-fills as the expected yield.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-6 py-4">
              <Button variant="ghost" onClick={closeForm}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                {form.mode === 'new' ? 'Create Recipe' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
