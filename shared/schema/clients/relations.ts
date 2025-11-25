/**
 * TEMPORARY SHIM: Relations re-exported from legacy schema
 * 
 * These relation definitions depend on tables from other domains (Projects, Services)
 * that have not yet been extracted. Once those domains are extracted (Stages 4-5),
 * these relations will be re-implemented with clean intra-module imports.
 * 
 * This shim maintains backward compatibility during the staged migration.
 */
export {
  clientsRelations,
  peopleRelations,
  clientPeopleRelations,
  clientChronologyRelations,
} from '../../schema';
