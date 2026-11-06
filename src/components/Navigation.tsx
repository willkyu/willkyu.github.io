import type { CategoryConfig } from '../config/types'

interface NavigationProps {
  categories: CategoryConfig[]
  activeCategoryIds: Set<string>
  onSelect: (category: CategoryConfig) => void
  contentCounts: Map<string, number>
}

export function Navigation({ categories, activeCategoryIds, onSelect, contentCounts }: NavigationProps) {
  return (
    <nav className="category-nav" aria-label="内容分类">
      {categories.filter((item) => item.visible).sort((a, b) => a.order - b.order).map((category, index) => {
        const count = contentCounts.get(category.id) ?? 0
        return (
          <button
            className="category-button"
            data-active={activeCategoryIds.has(category.id)}
            data-empty={count === 0}
            type="button"
            disabled={count === 0}
            key={category.id}
            onClick={() => onSelect(category)}
            aria-pressed={activeCategoryIds.has(category.id)}
            aria-label={`${category.label}，${count ? `${count} 条内容` : '暂无内容'}`}
          >
            <span className="category-button__number">0{index + 1}</span>
            <span className="category-button__icon" aria-hidden="true">{category.icon}</span>
            <span className="category-button__label">{category.label}</span>
            <span className="category-button__arrow" aria-hidden="true">→</span>
          </button>
        )
      })}
    </nav>
  )
}
