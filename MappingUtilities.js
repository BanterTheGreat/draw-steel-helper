export class MappingUtilities {
    async UpdateProps(entity, importJson) {
        // Try to find all the templates first. Without these we can't do anything.
        const passiveTemplateId = game.items.find(x => x.name === "_Passive")?.id;
        if (!passiveTemplateId) {
            ui.notifications.error("Can't find the '_Passive' Item Template.")
        }

        const actionTemplateId = game.items.find(x => x.name === "_Action")?.id;
        if (!actionTemplateId) {
            ui.notifications.error("Can't find the '_Action' Item Template.")
        }
        
        const actorData = {
            prototypeToken: {
                name: this.capitalizeFirstCharOfWord(importJson.name),
            },
            name: this.capitalizeFirstCharOfWord(importJson.name),
            system: {
                props: {
                    mcdm_size:  importJson.size,
                    mcdm_type:  this.capitalizeFirstCharOfWord(importJson.type),
                    mcdm_traits:  importJson.traits,
                    mcdm_weaknesses:  importJson.weaknesses,
                    mcdm_immunities:  importJson.immunities,
                    mcdm_level:  importJson.level,
                    mcdm_ev:  importJson.ev,
    
                    // Characteristics
                    mcdm_agility:  importJson.characteristics.agility,
                    mcdm_might:  importJson.characteristics.might,
                    mcdm_presence:  importJson.characteristics.presence,
                    mcdm_reason:  importJson.characteristics.reason,
                    mcdm_intuition:  importJson.characteristics.intuition,
    
                    mcdm_free_strike:  importJson.freeStrike,
                    mcdm_captain_bonus: importJson.withCaptain,
                    mcdm_speed:  importJson.speed,
                    mcdm_stability: importJson.stability,
                    mcdm_stamina_current: importJson.stamina,
                    mcdm_stamina_max:  importJson.stamina,
                }
            }
        }
        
        const updatedData = await entity.entity.update(actorData);
        
        // Passives
        const passives = importJson.passives.map(passive => {
            return {
                name: passive.name, 
                type: "equippableItem", 
                system: { 
                    template: passiveTemplateId, 
                    props: {
                        mcdm_passive_text: passive.description,
                        mcdm_collapsed: false,
                    } 
                } 
            };
        });
        
        let createdPassives = await Item.createDocuments(passives, { parent: entity.entity });
        createdPassives.forEach(newPassive => newPassive._templateSystem.reloadTemplate());
        
        // Abilities
        const abilities = importJson.abilities.map(ability => {
            return {
                name: ability.name,
                type: "equippableItem",
                system: {
                    template: actionTemplateId,
                    props: {
                        // props.mcdm_action_attack_type - Unused for NPCs
                        mcdm_action_collapsed: false,
                        mcdm_action_cost: ability.malice,
                        mcdm_action_damage_high_type: this.capitalizeFirstCharInString(ability.tier3?.result?.type ?? ''),
                        mcdm_action_damage_low_type: this.capitalizeFirstCharInString(ability.tier1?.result?.type ?? ''),
                        mcdm_action_damage_mid_type: this.capitalizeFirstCharInString(ability.tier2?.result?.type ?? ''),
                        mcdm_action_distance: ability.distance,
                        mcdm_action_target: ability.target,
                        mcdm_action_trigger: ability.trigger,
                        mcdm_action_extra_effect_description_1: ability.effects[0]?.effect ?? "",
                        mcdm_action_extra_effect_description_2: ability.effects[1]?.effect ?? "",
                        mcdm_action_extra_effect_title_1: ability.effects[0]?.header ?? "",
                        mcdm_action_extra_effect_title_2: ability.effects[1]?.header ?? "",
                        mcdm_action_low_damage: ability.tier1?.result?.damageAmount ?? 0,
                        mcdm_action_mid_damage: ability.tier2?.result?.damageAmount ?? 0,
                        mcdm_action_high_damage: ability.tier3?.result?.damageAmount ?? 0,
                        mcdm_action_low_text: ability.tier1?.result?.effect ?? "",
                        mcdm_action_mid_text: ability.tier2?.result?.effect ?? "",
                        mcdm_action_high_text: ability.tier3?.result?.effect ?? "",
                        mcdm_action_keywords: ability.keywords,
                        // mcdm_action_modifier: this.getModifier(ability), - Unused for Npcs.
                        mcdm_action_kit: false,
                        mcdm_action_roll_bonus: ability.diceBonus,
                        mcdm_action_roll_type: this.getRollType(ability),
                        mcdm_action_type: ability.actionType,
                        mcdm_action_user: "NPC",
                        mcdm_action_description: "",
                    }
                }
            }
        })

        let createdAbilities = await Item.createDocuments(abilities, { parent: entity.entity });
        createdAbilities.forEach(newPassive => newPassive._templateSystem.reloadTemplate());
        
        await entity.reloadTemplate();
    }
    
    capitalizeFirstCharInString(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    capitalizeFirstCharOfWord(str) {
        return str
            .toLowerCase() // Convert the whole string to lowercase
            .split(" ")    // Split the string into an array of words
            .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter
            .join(" ");
    }
    
    getRollType(ability) {
       if (ability.diceBonus) {
           return "power";
       }
       
       return "none";
    }
}