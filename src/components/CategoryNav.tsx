import type { Category } from '../types';

interface CategoryNavProps {
  categories: Category[];
  selected: string;
  onSelect: (categoryId: string) => void;
}

export default function CategoryNav({ categories, selected, onSelect }: CategoryNavProps) {
  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex gap-3 min-w-max">
        {categories.map((cat) => {
          const isActive = cat.id === selected;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-full text-lg font-bold
                transition-all duration-300 transform hover:scale-105
                whitespace-nowrap
                ${isActive
                  ? 'text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50 shadow-md'
                }
              `}
              style={isActive ? { backgroundColor: cat.color } : {}}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
