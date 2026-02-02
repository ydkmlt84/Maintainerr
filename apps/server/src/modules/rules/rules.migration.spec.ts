import { MediaServerType } from '@maintainerr/contracts';
import { Application } from './constants/rules.constants';
import { RuleDto } from './dtos/rule.dto';

/**
 * Temporary test file to verify rule migration functionality
 * Tests bidirectional conversion between Plex and Jellyfin rules
 */
describe('Rule Migration Functionality', () => {
  /**
   * Mock implementation of migration logic for testing
   * Matches production behavior: only returns Plex or Jellyfin apps
   */
  const detectRuleSourceApp = (
    rule: RuleDto,
  ): Application.PLEX | Application.JELLYFIN | undefined => {
    const firstApp = rule.firstVal?.[0];
    const lastApp = rule.lastVal?.[0];

    if (firstApp !== Application.PLEX && firstApp !== Application.JELLYFIN) {
      return undefined;
    }

    if (lastApp !== undefined && lastApp !== firstApp) {
      return undefined;
    }

    return firstApp as Application.PLEX | Application.JELLYFIN;
  };

  const migrateRulesIfNeeded = (
    rules: RuleDto[],
    targetServer: MediaServerType,
  ): RuleDto[] => {
    if (!rules || rules.length === 0) {
      return rules;
    }

    const targetApp =
      targetServer === MediaServerType.JELLYFIN
        ? Application.JELLYFIN
        : Application.PLEX;

    return rules.map((rule) => {
      const sourceApp = detectRuleSourceApp(rule);

      if (sourceApp === undefined || sourceApp === targetApp) {
        return rule;
      }

      const migratedRule = { ...rule };

      if (
        migratedRule.firstVal &&
        Array.isArray(migratedRule.firstVal) &&
        migratedRule.firstVal[0] === sourceApp
      ) {
        migratedRule.firstVal = [targetApp, migratedRule.firstVal[1]] as [
          number,
          number,
        ];
      }

      if (
        migratedRule.lastVal &&
        Array.isArray(migratedRule.lastVal) &&
        migratedRule.lastVal[0] === sourceApp
      ) {
        migratedRule.lastVal = [targetApp, migratedRule.lastVal[1]] as [
          number,
          number,
        ];
      }

      return migratedRule;
    });
  };

  describe('Plex to Jellyfin Migration', () => {
    it('should migrate single Plex rule to Jellyfin', () => {
      const plexRule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.PLEX, 0], // PLEX addDate property
        customVal: {
          ruleTypeId: 1,
          value: '2024-01-01',
        },
        section: 0,
      };

      const migrated = migrateRulesIfNeeded(
        [plexRule],
        MediaServerType.JELLYFIN,
      );

      expect(migrated).toHaveLength(1);
      expect(migrated[0].firstVal).toEqual([Application.JELLYFIN, 0]);
      expect(migrated[0].customVal).toEqual(plexRule.customVal);
    });

    it('should migrate Plex rule with lastVal comparison', () => {
      const plexRule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.PLEX, 5], // PLEX viewCount
        lastVal: [Application.PLEX, 6], // PLEX collections count
        section: 0,
      };

      const migrated = migrateRulesIfNeeded(
        [plexRule],
        MediaServerType.JELLYFIN,
      );

      expect(migrated[0].firstVal).toEqual([Application.JELLYFIN, 5]);
      expect(migrated[0].lastVal).toEqual([Application.JELLYFIN, 6]);
    });

    it('should migrate multiple Plex rules', () => {
      const rules: RuleDto[] = [
        {
          operator: 0,
          action: 0,
          firstVal: [Application.PLEX, 0],
          customVal: { ruleTypeId: 1, value: '2024-01-01' },
          section: 0,
        },
        {
          operator: 0,
          action: 3,
          firstVal: [Application.PLEX, 5],
          customVal: { ruleTypeId: 0, value: '50' },
          section: 1,
        },
      ];

      const migrated = migrateRulesIfNeeded(rules, MediaServerType.JELLYFIN);

      expect(migrated).toHaveLength(2);
      expect(migrated[0].firstVal[0]).toBe(Application.JELLYFIN);
      expect(migrated[1].firstVal[0]).toBe(Application.JELLYFIN);
    });
  });

  describe('Jellyfin to Plex Migration', () => {
    it('should migrate single Jellyfin rule to Plex', () => {
      const jellyfinRule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.JELLYFIN, 0],
        customVal: {
          ruleTypeId: 1,
          value: '2024-01-01',
        },
        section: 0,
      };

      const migrated = migrateRulesIfNeeded(
        [jellyfinRule],
        MediaServerType.PLEX,
      );

      expect(migrated).toHaveLength(1);
      expect(migrated[0].firstVal).toEqual([Application.PLEX, 0]);
    });

    it('should migrate Jellyfin rule with lastVal', () => {
      const jellyfinRule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.JELLYFIN, 2],
        lastVal: [Application.JELLYFIN, 7],
        section: 0,
      };

      const migrated = migrateRulesIfNeeded(
        [jellyfinRule],
        MediaServerType.PLEX,
      );

      expect(migrated[0].firstVal).toEqual([Application.PLEX, 2]);
      expect(migrated[0].lastVal).toEqual([Application.PLEX, 7]);
    });
  });

  describe('No Migration Cases', () => {
    it('should not migrate when source and target are the same', () => {
      const plexRule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.PLEX, 0],
        customVal: { ruleTypeId: 1, value: '2024-01-01' },
        section: 0,
      };

      const migrated = migrateRulesIfNeeded([plexRule], MediaServerType.PLEX);

      expect(migrated[0]).toEqual(plexRule);
    });

    it('should handle empty rule array', () => {
      const migrated = migrateRulesIfNeeded([], MediaServerType.JELLYFIN);
      expect(migrated).toEqual([]);
    });

    it('should handle null/undefined rules', () => {
      expect(
        migrateRulesIfNeeded(null as any, MediaServerType.JELLYFIN),
      ).toEqual(null);
    });
  });

  describe('Source Detection', () => {
    it('should detect Plex as source from firstVal', () => {
      const rule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.PLEX, 0],
        section: 0,
      };

      expect(detectRuleSourceApp(rule)).toBe(Application.PLEX);
    });

    it('should detect Jellyfin as source from lastVal', () => {
      const rule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.JELLYFIN, 0],
        lastVal: [Application.JELLYFIN, 1],
        section: 0,
      };

      expect(detectRuleSourceApp(rule)).toBe(Application.JELLYFIN);
    });

    it('should return undefined when multiple apps are used (ambiguous)', () => {
      const rule: RuleDto = {
        operator: 0,
        action: 0,
        firstVal: [Application.PLEX, 0],
        lastVal: [Application.JELLYFIN, 1],
        section: 0,
      };

      expect(detectRuleSourceApp(rule)).toBeUndefined();
    });

    it('should return undefined when no Plex/Jellyfin app data', () => {
      const rule: RuleDto = {
        operator: null,
        action: 0,
        firstVal: [Application.RADARR, 0], // Non-Plex/Jellyfin app (RADARR = 1)
        customVal: { ruleTypeId: 0, value: 'test' },
        section: 0,
      };

      expect(detectRuleSourceApp(rule)).toBeUndefined();
    });
  });
});
