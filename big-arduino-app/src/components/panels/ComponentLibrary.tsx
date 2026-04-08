import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useHighlightedToolbarComponents } from '../../store/circuitStore';
import { ComponentItem } from '../shared/ComponentItem';
import { getComponentLibrarySections } from '../../services/componentService';
import type { LibraryComponentSection } from '../../types/components';
import './ComponentLibrary.css';

interface ComponentLibraryProps {
  onComponentDragStart?: (componentId: string) => void;
}

export function ComponentLibrary({ onComponentDragStart }: ComponentLibraryProps) {
  const projectNeededSectionId = 'project-needed';
  const [searchQuery, setSearchQuery] = useState('');
  const [componentCategories, setComponentCategories] = useState<LibraryComponentSection[]>([]);
  const highlightedComponents = useHighlightedToolbarComponents();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set([
      projectNeededSectionId,
      'basics',
      'buttons-inputs',
      'outputs',
      'modules-ics',
    ])
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

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const projectNeededSection = useMemo<LibraryComponentSection | null>(() => {
    if (highlightedComponents.length === 0 || componentCategories.length === 0) {
      return null;
    }

    const componentMap = new Map(
      componentCategories.flatMap(section =>
        section.components.map(component => [component.id, component] as const)
      )
    );

    const components = highlightedComponents
      .map(componentId => componentMap.get(componentId))
      .filter((component): component is NonNullable<typeof component> => Boolean(component));

    if (components.length === 0) {
      return null;
    }

    return {
      id: projectNeededSectionId,
      name: 'For This Project',
      components,
    };
  }, [componentCategories, highlightedComponents]);

  useEffect(() => {
    if (!projectNeededSection) return;

    setExpandedCategories(prev => {
      if (prev.has(projectNeededSectionId)) return prev;
      const next = new Set(prev);
      next.add(projectNeededSectionId);
      return next;
    });
  }, [projectNeededSection]);

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

  const sectionsToRender = projectNeededSection
    ? [projectNeededSection, ...componentCategories]
    : componentCategories;

  const filteredCategories = sectionsToRender
    .map(category => ({
      ...category,
      components: category.components.filter(comp =>
        (comp.searchText || comp.name.toLowerCase()).includes(normalizedSearchQuery)
      ),
    }))
    .filter(category => category.components.length > 0);

  return (
    <div className="component-library">
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
          <div
            key={category.id}
            className={`component-category ${category.id === projectNeededSectionId ? 'component-category--project-needed' : ''}`}
          >
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
                    key={`${category.id}-${component.id}`}
                    component={component}
                    category={component.folder}
                    highlighted={category.id === projectNeededSectionId}
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
