import { useMemo, useState } from 'react'

import type { CategoryTreeItem } from '../types'

const categoryOptionsFromTree = (categories: CategoryTreeItem[]) =>
  categories.map((category) => ({
    id: category.id,
    label: category.name,
  }))

export function useCategoryState(categories: CategoryTreeItem[]) {
  const [manualCategoryRaw, setManualCategoryRaw] = useState('')
  const [manualSubcategoryRaw, setManualSubcategoryRaw] = useState('')
  const [recurringCategoryRaw, setRecurringCategoryRaw] = useState('')
  const [recurringSubcategoryRaw, setRecurringSubcategoryRaw] = useState('')
  const [newSubcategoryCategoryIdRaw, setNewSubcategoryCategoryIdRaw] = useState('')
  const [categoryDraftOverrides, setCategoryDraftOverrides] = useState<
    Record<string, { name: string; color: string }>
  >({})
  const [subcategoryDraftOverrides, setSubcategoryDraftOverrides] = useState<
    Record<string, { name: string; categoryId: string }>
  >({})

  const categoryOptions = useMemo(() => categoryOptionsFromTree(categories), [categories])

  const subcategoriesByCategory = useMemo(() => {
    const map: Record<string, CategoryTreeItem['subcategories']> = {}
    for (const category of categories) {
      map[category.id] = category.subcategories
    }
    return map
  }, [categories])

  const allSubcategories = useMemo(
    () =>
      categories.flatMap((category) =>
        category.subcategories.map((sub) => ({
          ...sub,
          categoryName: category.name,
        })),
      ),
    [categories],
  )

  const firstCategory = categories[0]?.id ?? ''
  const hasCategory = (categoryId: string) => categories.some((category) => category.id === categoryId)
  const hasSubcategory = (categoryId: string, subcategoryId: string) =>
    (subcategoriesByCategory[categoryId] ?? []).some((subcategory) => subcategory.id === subcategoryId)

  const manualCategory = manualCategoryRaw && hasCategory(manualCategoryRaw) ? manualCategoryRaw : firstCategory
  const recurringCategory =
    recurringCategoryRaw && hasCategory(recurringCategoryRaw) ? recurringCategoryRaw : firstCategory
  const newSubcategoryCategoryId =
    newSubcategoryCategoryIdRaw && hasCategory(newSubcategoryCategoryIdRaw)
      ? newSubcategoryCategoryIdRaw
      : firstCategory

  const manualSubcategory =
    manualSubcategoryRaw && hasSubcategory(manualCategory, manualSubcategoryRaw) ? manualSubcategoryRaw : ''
  const recurringSubcategory =
    recurringSubcategoryRaw && hasSubcategory(recurringCategory, recurringSubcategoryRaw)
      ? recurringSubcategoryRaw
      : ''

  const categoryDrafts = useMemo(() => {
    const drafts: Record<string, { name: string; color: string }> = {}
    for (const category of categories) {
      drafts[category.id] = categoryDraftOverrides[category.id] ?? {
        name: category.name,
        color: category.color,
      }
    }
    return drafts
  }, [categories, categoryDraftOverrides])

  const subcategoryDrafts = useMemo(() => {
    const drafts: Record<string, { name: string; categoryId: string }> = {}
    for (const category of categories) {
      for (const subcategory of category.subcategories) {
        drafts[subcategory.id] = subcategoryDraftOverrides[subcategory.id] ?? {
          name: subcategory.name,
          categoryId: subcategory.categoryId,
        }
      }
    }
    return drafts
  }, [categories, subcategoryDraftOverrides])

  const setManualCategoryWithReset = (value: string) => {
    setManualCategoryRaw(value)
    setManualSubcategoryRaw('')
  }

  const setRecurringCategoryWithReset = (value: string) => {
    setRecurringCategoryRaw(value)
    setRecurringSubcategoryRaw('')
  }

  const setCategoryDraftName = (categoryId: string, value: string) => {
    const category = categories.find((item) => item.id === categoryId)
    if (!category) return
    setCategoryDraftOverrides((previous) => ({
      ...previous,
      [categoryId]: {
        ...(previous[categoryId] ?? { name: category.name, color: category.color }),
        name: value,
      },
    }))
  }

  const setCategoryDraftColor = (categoryId: string, value: string) => {
    const category = categories.find((item) => item.id === categoryId)
    if (!category) return
    setCategoryDraftOverrides((previous) => ({
      ...previous,
      [categoryId]: {
        ...(previous[categoryId] ?? { name: category.name, color: category.color }),
        color: value,
      },
    }))
  }

  const setSubcategoryDraftCategory = (subcategoryId: string, value: string) => {
    const subcategory = allSubcategories.find((item) => item.id === subcategoryId)
    if (!subcategory) return
    setSubcategoryDraftOverrides((previous) => ({
      ...previous,
      [subcategoryId]: {
        ...(previous[subcategoryId] ?? { name: subcategory.name, categoryId: subcategory.categoryId }),
        categoryId: value,
      },
    }))
  }

  const setSubcategoryDraftName = (subcategoryId: string, value: string) => {
    const subcategory = allSubcategories.find((item) => item.id === subcategoryId)
    if (!subcategory) return
    setSubcategoryDraftOverrides((previous) => ({
      ...previous,
      [subcategoryId]: {
        ...(previous[subcategoryId] ?? { name: subcategory.name, categoryId: subcategory.categoryId }),
        name: value,
      },
    }))
  }

  return {
    categoryOptions,
    subcategoriesByCategory,
    allSubcategories,
    manualCategory,
    setManualCategoryWithReset,
    manualSubcategory,
    setManualSubcategory: setManualSubcategoryRaw,
    recurringCategory,
    setRecurringCategoryWithReset,
    recurringSubcategory,
    setRecurringSubcategory: setRecurringSubcategoryRaw,
    newSubcategoryCategoryId,
    setNewSubcategoryCategoryId: setNewSubcategoryCategoryIdRaw,
    categoryDrafts,
    subcategoryDrafts,
    setCategoryDraftName,
    setCategoryDraftColor,
    setSubcategoryDraftCategory,
    setSubcategoryDraftName,
  }
}
