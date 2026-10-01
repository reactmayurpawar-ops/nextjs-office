import { Icon } from '@/components/ui/Icon';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  placeholder: string;
  action: string;
}

/**
 * Trane Supply search field: rounded pill, left magnifier, and the red
 * camera (name-plate reader) affordance on the right.
 */
export function SearchBar({ placeholder, action }: SearchBarProps) {
  return (
    <form className={styles.search} action={action} role="search">
      <Icon name="search" size={20} className={styles.searchIcon} />
      <input
        type="search"
        name="q"
        className={styles.input}
        placeholder={placeholder}
        aria-label="Search"
      />
      <button
        type="button"
        className={styles.camera}
        aria-label="Search by photo (name plate reader)"
      >
        <Icon name="camera" size={22} />
      </button>
    </form>
  );
}
