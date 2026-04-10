import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useHighlightedToolbarComponents } from '../../store/circuitStore';
import { ComponentItem } from '../shared/ComponentItem';
import { getComponentLibrarySections } from '../../services/componentService';
import type { LibraryComponentSection } from '../../types/components';
import './ComponentLibrary.css';

interface ComponentLibraryProps {
  onComponentDragStart?: (componentId: string) => void;
  allowedComponentIds?: string[];
  titleOverride?: string;
  descriptionOverride?: string;
}

export function ComponentLibrary({
  onComponentDragStart,
  allowedComponentIds,
  titleOverride,
  descriptionOverride,
}: ComponentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [componentCategories, setComponentCategories] = useState<LibraryComponentSection[]>([]);
  const highlightedComponents = useHighlightedToolbarComponents();
  const allowedSet = allowedComponentIds ? new Set(allowedComponentIds.map(id => id.toLowerCase())) : null;
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['boards', 'microcontrollers', 'input', 'output', 'passive', 'sensors', 'displays', 'modules', 'logic'])
  );

  useEffect(() => {
    let cancelled = false;

    getComponentLibrarySections()
      .then(sections => {
        if (!cancelled) {
          setComponentCategories(sections);
          setExpandedCategories(prev => {
            if (prev.size > 0) return prev;
            return new Set(sections.map(section => section.id));
          });
        }
      })
      .catch(error => {
        console.error('[ComponentLibrary] Failed to load component library sections:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const filteredCategories = componentCategories.map(category => ({
    ...category,
    components: category.components.filter(comp => {
      const matchesSearch = comp.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAllowed = !allowedSet || allowedSet.has(comp.id.toLowerCase());
      return matchesSearch && matchesAllowed;
    })
  })).filter(category => category.components.length > 0);

  return (
    <div className="component-library">
      {(titleOverride || descriptionOverride) && (
        <div className="component-library-context">
          {titleOverride && <div className="component-library-context__title">{titleOverride}</div>}
          {descriptionOverride && <div className="component-library-context__description">{descriptionOverride}</div>}
        </div>
      )}
      {/* Search */}
      <div className="component-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="component-categories">
        {filteredCategories.map(category => (
          <div key={category.id} className="component-category">
            <button
              className="category-header"
              onClick={() => toggleCategory(category.id)}
            >
              {expandedCategories.has(category.id) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <span>{category.name}</span>
              <span className="category-count">{category.components.length}</span>
            </button>

            {expandedCategories.has(category.id) && (
              <div className="category-components">
                {category.components.map(component => (
                  <ComponentItem
                    key={component.id}
                    component={component}
                    category={component.folder}
                    highlighted={highlightedComponents.includes(component.id)}
                    onDragStart={onComponentDragStart}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
