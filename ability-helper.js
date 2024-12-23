import {EnemyImporter} from "./enemy-importer.js";
import {MappingUtilities} from "./MappingUtilities.js";

export class AbilityHelper {
  async rollAbility(message, socket) {
    // Create the dialog
    new Dialog({
      title: "Select Options",
      content: `
        <form>
          <div class="form-group">
              <label for="modifier">Modifier:</label>
              <input id="modifier" name="modifier" type="number" min="0" max="4" value="0" style="width: 50px;">
          </div>
          <div class="form-group">
            <label for="effect">Edges/Banes:</label>
            <select id="effect" name="effect">
              <option value="none">None</option>
              <option value="doubleEdge">Double Edge</option>
              <option value="edge">Edge</option>
              <option value="bane">Bane</option>
              <option value="doubleBane">Double Bane</option>
            </select>
          </div>
          <div class="form-group">
            <label>Surges:</label>
            <div style="display: flex; gap: 10px;">
                <label><input type="radio" name="surge" value="0" checked> 0</label>
                <label><input type="radio" name="surge" value="1"> 1</label>
                <label><input type="radio" name="surge" value="2"> 2</label>
                <label><input type="radio" name="surge" value="3"> 3</label>
            </div>
          </div>
        </form>
      `,
      buttons: {
        roll: {
          label: "Roll",
          callback: async (dialogHtml) => {
            
            let html;
            let modifier = parseInt(dialogHtml.find('[name="modifier"]').val()) || 0;
            const surges = parseInt(dialogHtml.find("input[name='surge']:checked").val()) || 0;
            let effect = dialogHtml.find('[name="effect"]').val();
    
            // Set ability modifier
            const abilityModifier = message.flags.abilityRoller.abilityModifier;
            const damage = message.flags.abilityRoller.damage;

            // Determine roll formula and flavor text
            let rollFormula = '2d10';
            let flavorText = "";
            
            if (modifier !== 0) {
              rollFormula += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
              flavorText += modifier > 0 ? `${modifier}` : ` -${Math.abs(modifier)}`;
            }
            
            rollFormula += abilityModifier >= 0 ? ` + ${abilityModifier}` : ` - ${Math.abs(abilityModifier)}`;
            flavorText += abilityModifier >= 0 ? ` + ${abilityModifier} (${message.flags.abilityRoller.characteristic})` : ` - ${Math.abs(abilityModifier)} (${message.flags.abilityRoller.characteristic})`;
            
            if (effect === "edge") {
              rollFormula += ' + 2';
              flavorText += " with an edge";
            } else if (effect === "bane") {
              rollFormula += ' - 2';
              flavorText += " with a bane";
            } else if (effect === "doubleEdge") {
              flavorText += " with a double edge";
            } else if (effect === "doubleBane") {
              flavorText += " with a double bane";
            }

            const rollTest = new Roll(rollFormula);
            rollTest.propagateFlavor(flavorText);

            // Roll 2d10 with modifiers
            let roll = await rollTest.evaluate();
    
            // Get initial roll result
            let rollResults = roll.terms[0].results.map(die => die.result);
            let initialTotal = rollResults.reduce((a, b) => a + b, 0);
    
            // Determine if a critical hit occurs
            let isCritical = (initialTotal === 19 || initialTotal === 20);
    
            // Determine result after modifiers
            let result = roll.total;
    
            // If natural 20, override tier result to 3
            if (isCritical) {
              result = 20; // Force result to 20 to get tier 3
            }
    
            // Determine tier
            let tier;
            if (result <= 11) {
              tier = 1;
            } else if (result <= 16) {
              tier = 2;
            } else {
              tier = 3;
            }
    
            // Adjust tier based on double effects
            if (effect === "doubleEdge" && !isCritical) {
              tier = Math.min(tier + 1, 3);
            } else if (effect === "doubleBane" && !isCritical) {
              tier = Math.max(tier - 1, 1);
            }

            // Display result after dice finish rolling
            html = `<hr>
              <pg>${await roll.render()}</pg>
            `;

            // Add critical hit message if applicable
            if (isCritical) {
              html += `<h2><strong>Critical!</strong></h2>`;
            }

            let newContent = message.content
                .replace(/(<hr\s*\/?>\s*)<button id="rollButton">(.*?)<\/button>/, function (match, hrTag, buttonContent) {
                  // Replace the button with a disabled version
                  return `${hrTag}<button id="rollButton" disabled>${buttonContent}</button>`;
                });

            // Manually call Dice so Nice, as it doesn't trigger the way we edit the message.
            if (game.dice3d) {
              // Immediately disable the button when Dice so Nice starts, to prevent people mashing.
              await socket.executeAsGM("updateMessage", message.id, {...message, content: newContent});
              await game.dice3d.showForRoll(roll, game.user, true);
            }
            
            // Remove the button with the `id="rollButton"`
            // Replace the invisible <span> with the Roll html.
            // Bolden the Tier of the table.
            newContent = newContent
              .replace(/<hr\s*\/?>\s*<button id="rollButton" disabled>.*?<\/button>/, "")
              .replace(/<span style="display:none">.*?<\/span>/, html);

            // Regex to find only the row for the selected tier (match exactly Tier1, Tier2, or Tier3)
            // We ensure it only matches the specific tier's row by using boundary markers for tier-specific rows.
            const rowRegex = new RegExp(`<td[^>]*id="(tier${tier}|tier${tier}_damage)"[^>]*>(.*?)</td>`, 'gs');

            // Find the row that matches the given tier
            const matchingRows = [...newContent.matchAll(rowRegex)];

            try {
              if (matchingRows.length > 0) {
                // If the matching row exists, replace the entire table with the matching row
                // Replace the content of the table with the matching row for the selected tier
                newContent = newContent.replace(/<table>.*?<\/table>/, `<table><tbody>${matchingRows[0][0]}${matchingRows[1][0]}</tbody></table>`);
              }
            } catch {
              console.error("RegEx Matching went wrong. We won't do anything for now.")
            }

            const damages = [damage.tier_1, damage.tier_2, damage.tier_3];
            const damageToTake = damages[tier - 1];
            
            const damageText = damageToTake + (surges === 0 ? "" : (" + " + (surges * 2) + ` (${surges} surges)`));

            if (!!damageToTake && damageToTake > 0) {
              newContent += `<hr><button id="damageButton">Take ${damageText} damage</button>`;
            } 

            await socket.executeAsGM("updateMessage", message.id, {...message, content: newContent, flags: { applyDamage: damageToTake + (2 * surges) }});
            // await ChatMessage.create({...message, content: newContent, flags: { applyDamage: damageToTake }});
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => {
          }
        }
      },
      default: "roll"
    }).render(true);
  }

  applyDamage(message) {
    const userCharacter = game.user.character;
    const controlledTokens = canvas.tokens.controlled;
    let actorsToDamage = [];
    let damage = message.flags.applyDamage;

    if (controlledTokens.length > 0) {
      // actor.system.props;
      actorsToDamage = controlledTokens.map(x => x.actor);
    }

    if (!!userCharacter) {
      // system.props;
      actorsToDamage = [userCharacter];
    }

    if (actorsToDamage.length === 0) {
      ui.notifications.warn("No token or character selected to apply damage to.");
      return;
    }

    if (typeof damage !== 'number' || isNaN(damage)) {
      ui.notifications.warn(`Damage to apply is invalid: ${damage}`);
      return;
    }
    
    actorsToDamage.forEach(actor => {
      let damageCalc = damage;
      const isNPC = actor.system.props.mcdm_enemy === "true";
      const minHealth = actor.system.props.mcdm_stamina_winded ? -actor.system.props.mcdm_stamina_winded : 0;
      
      const currentHealth = actor.system.props.mcdm_stamina_current;
      let newHealth = currentHealth;
      
      const currentTempHealth = actor.system.props.mcdm_stamina_temp ?? 0;
      let newTempHealth = currentTempHealth;

      // First, subtract damage from TempHealth, but TempHealth cannot go below 0
      if (damageCalc <= currentTempHealth) {
        newTempHealth -= damageCalc;  // If the damage is less than or equal to TempHealth, just subtract it
        damageCalc = 0;  // No more damage left to apply to Health
      } else {
        damageCalc -= currentTempHealth;  // The remaining damage after TempHealth is depleted
        newTempHealth = 0;  // TempHealth becomes 0
      }

      // Then, subtract the remaining damage from Health (Health can go negative)
      newHealth = currentHealth - damageCalc;
      
      if (newHealth < minHealth) {
        newHealth = minHealth;
      }
      
      // Initialize the message array
      let messages = [];

      // Check if the character loses temporary stamina and takes damage
      if (damage > 0) {
        messages.push(`${actor.name} takes ${damage} damage,`);
        
        if (newTempHealth < currentTempHealth) {
          messages.push(`they got ${newTempHealth} temporary stamina and ${newHealth} stamina left.`);
        } else {
          messages.push(`they got ${newHealth} stamina left.`);
        }
      }

      // Check if the character is winded
      if (newHealth > 0 && newHealth <= Math.abs(minHealth)) {
        messages.push("They are <strong>winded</strong>.");
      }

      // Check if the character is dying
      if (newHealth <= 0 && newHealth > minHealth) {
        messages.push("They are <strong>dying</strong>.");
      }

      // Check if the character is dead
      if (newHealth === minHealth) {
        messages.push("They are <strong>dead</strong>.");
      }

      actor.system.props.mcdm_stamina_current = newHealth;
      actor.system.props.mcdm_stamina_temp = newTempHealth;
      actor.reloadTemplate();

      const privateMessage = (game.user.isGM && isNPC) ? [game.user.id] : [];

      // Send the message to the chat
      let chatMessage = messages.join(' ');
      ChatMessage.create({
        content: `<span style="color: red">${chatMessage}</span>`,
        speaker: {
          alias: actor.name,
          actor: actor,
        },
        whisper: privateMessage,
      });
    });
  }

  // Methods used inside scripts themselves
  getActionSummary(entity, linkedEntity) {
    const isCollapsed = linkedEntity.system.props.mcdm_action_collapsed;
    const title1 = linkedEntity.system.props.mcdm_action_extra_effect_title_1;
    const text1 = linkedEntity.system.props.mcdm_action_extra_effect_description_1;
    const title2 = linkedEntity.system.props.mcdm_action_extra_effect_title_2;
    const text2 = linkedEntity.system.props.mcdm_action_extra_effect_description_2;
    const attack_type = linkedEntity.system.props.mcdm_action_attack_type;
    const description = linkedEntity.system.props.mcdm_action_description;
    const tier1_melee = entity.entity.system.props.mcdm_kit_melee_low ?? 0;
    const tier2_melee = entity.entity.system.props.mcdm_kit_melee_mid ?? 0;
    const tier3_melee = entity.entity.system.props.mcdm_kit_melee_high ?? 0;
    const tier1_ranged = entity.entity.system.props.mcdm_kit_ranged_low ?? 0;
    const tier2_ranged = entity.entity.system.props.mcdm_kit_ranged_mid ?? 0;
    const tier3_ranged = entity.entity.system.props.mcdm_kit_ranged_high ?? 0;
    const rollType = linkedEntity.system.props.mcdm_action_roll_type;
    const tier1_extra = linkedEntity.system.props.mcdm_action_low_text;
    const tier2_extra = linkedEntity.system.props.mcdm_action_mid_text;
    const tier3_extra = linkedEntity.system.props.mcdm_action_high_text;
    const tier1_type = linkedEntity.system.props.mcdm_action_damage_low_type;
    const tier2_type = linkedEntity.system.props.mcdm_action_damage_mid_type;
    const tier3_type = linkedEntity.system.props.mcdm_action_damage_high_type;
    const tier1_damage = linkedEntity.system.props.mcdm_action_low_damage;
    const tier2_damage = linkedEntity.system.props.mcdm_action_mid_damage;
    const tier3_damage = linkedEntity.system.props.mcdm_action_high_damage;
    const tier1_damage_modifier = linkedEntity.system.props.mcdm_action_damage_low_modifier ?? "None";
    const tier2_damage_modifier = linkedEntity.system.props.mcdm_action_damage_mid_modifier ?? "None";
    const tier3_damage_modifier = linkedEntity.system.props.mcdm_action_damage_high_modifier ?? "None";
    const cost = linkedEntity.system.props.mcdm_action_cost;
    const distance = linkedEntity.system.props.mcdm_action_distance;
    const target = linkedEntity.system.props.mcdm_action_target;
    const keywords = linkedEntity.system.props.mcdm_action_keywords;
    const type = linkedEntity.system.props.mcdm_action_type;
    const trigger = linkedEntity.system.props.mcdm_action_trigger;
    const use_kit = linkedEntity.system.props.mcdm_action_kit;

    const collapsed = isCollapsed === true;

    let html = !!description ? `<i>${description}</i><br>` : '';

    let tier1KitDamageBonus = 0;
    let tier2KitDamageBonus = 0;
    let tier3KitDamageBonus = 0;

    if (use_kit === true) {
      switch (attack_type) {
        case ("melee"):
          tier1KitDamageBonus = tier1_melee;
          tier2KitDamageBonus = tier2_melee;
          tier3KitDamageBonus = tier3_melee;
          break;
        case ("ranged"):
          tier1KitDamageBonus = tier1_ranged;
          tier2KitDamageBonus = tier2_ranged;
          tier3KitDamageBonus = tier3_ranged;
          break;
      }
    }

    const tier1KitDamageBonusText = tier1KitDamageBonus != 0 ? ` + ${tier1KitDamageBonus} `: "";
    const tier2KitDamageBonusText = tier2KitDamageBonus != 0 ? ` + ${tier2KitDamageBonus} `: "";
    const tier3KitDamageBonusText = tier3KitDamageBonus != 0 ? ` + ${tier3KitDamageBonus} `: "";

    const GetModifier = (type) => {
      switch (type) {
        case "Might":
          return {abbreviation: "M"};
        case "Agility":
          return {abbreviation: "A"};
        case "Presence":
          return {abbreviation: "P"};
        case "Intuition":
          return {abbreviation: "I"};
        case "Reason":
          return {abbreviation: "R"};
        case "None":
          return {abbreviation: ""};
      }
    }

    const tier1Modifier = GetModifier(tier1_damage_modifier);
    const tier2Modifier = GetModifier(tier2_damage_modifier);
    const tier3Modifier = GetModifier(tier3_damage_modifier);

    const tier1ModifierBonusText = tier1Modifier.abbreviation !== "" ? `+ ${tier1Modifier.abbreviation}`: "";
    const tier2ModifierBonusText = tier2Modifier.abbreviation !== "" ? `+ ${tier2Modifier.abbreviation}`: "";
    const tier3ModifierBonusText = tier3Modifier.abbreviation !== "" ? `+ ${tier3Modifier.abbreviation}`: "";

    let tier1DamageText = '';
    let tier2DamageText = '';
    let tier3DamageText = '';

    if (tier1_damage != 0) {
      tier1DamageText = tier1_damage + `${tier1KitDamageBonusText} ${tier1ModifierBonusText}`.trimEnd() + ` ${tier1_type} damage;`;
    }

    if (tier2_damage != 0) {
      tier2DamageText = tier2_damage + `${tier2KitDamageBonusText} ${tier2ModifierBonusText}`.trimEnd() + ` ${tier2_type} damage;`;
    }

    if (tier3_damage != 0) {
      tier3DamageText = tier3_damage + `${tier3KitDamageBonusText} ${tier3ModifierBonusText}`.trimEnd() + ` ${tier3_type} damage;`;
    }

    const showInfoBlock = keywords || distance || target || cost || trigger;

    const costHtml = cost > 0 ? `◆ <b>Cost:</b> ${cost}` : '';
    const typeHtml = `<b>Type:</b> ${type}`;

    const targetHtml = !!target ? `<b>Target:</b> ${target}` : '';
    const durationHtml = !!distance ? `◆ <b>Distance:</b> ${distance}` : '';

    if (showInfoBlock) {
      html += `<div>`;
        html += `<div>${typeHtml} ${costHtml} ${durationHtml}<br></div>`;
        !!keywords & !collapsed ? html += `<div><b>Keywords:</b> ${keywords}<br></div>` : '';
        html += `<div>${targetHtml}<br></div>`;
        !!trigger ? html +=  `<div><b>Trigger:</b> ${trigger}<br></div>` : '';
      html += `</div>`;
    }
    
    if (collapsed) {
      return html;
    }
    
    if (rollType != 'none') {
      html += `<div>`;
      html += `<table>`
      html +=  `<tr><td style=width:15%>Tier1: </td><td><strong> ${tier1DamageText} ${tier1_extra}</strong></td></tr>`
      html +=  `<tr><td style=width:15%>Tier2: </td><td><strong> ${tier2DamageText} ${tier2_extra}</strong></td></tr>`
      html += `<tr><td style=width:15%>Tier3: </td><td><strong> ${tier3DamageText} ${tier3_extra}</strong></td></tr>`
      html += `</table>`
      html += `</div>`
    }
    
    if (title1 !== "") {
      html += `<div><strong>${title1}:</strong> ${text1}</div>`;
    }
    
    if (title2 !== "") {
      html += `<div><strong>${title2}:</strong> ${text2}</div>`;
    }
    
    return html
  }
  
  sendActionToChat(entity, linkedEntity) {
    let actorName = entity.name;
    let name = linkedEntity.name;
    const description = linkedEntity.system.props.mcdm_action_description;
    const title1 = linkedEntity.system.props.mcdm_action_extra_effect_title_1;
    const text1 = linkedEntity.system.props.mcdm_action_extra_effect_description_1;
    const title2 = linkedEntity.system.props.mcdm_action_extra_effect_title_2;
    const text2 = linkedEntity.system.props.mcdm_action_extra_effect_description_2;
    const attack_type = linkedEntity.system.props.mcdm_action_attack_type;
    const tier1_melee = entity.entity.system.props.mcdm_kit_melee_low ?? 0;
    const tier2_melee = entity.entity.system.props.mcdm_kit_melee_mid ?? 0;
    const tier3_melee = entity.entity.system.props.mcdm_kit_melee_high ?? 0;
    const tier1_ranged = entity.entity.system.props.mcdm_kit_ranged_low ?? 0;
    const tier2_ranged = entity.entity.system.props.mcdm_kit_ranged_mid ?? 0;
    const tier3_ranged = entity.entity.system.props.mcdm_kit_ranged_high ?? 0;
    const rollType = linkedEntity.system.props.mcdm_action_roll_type;
    const tier1_damage = linkedEntity.system.props.mcdm_action_low_damage;
    const tier2_damage = linkedEntity.system.props.mcdm_action_mid_damage;
    const tier3_damage = linkedEntity.system.props.mcdm_action_high_damage;
    const tier1_type = linkedEntity.system.props.mcdm_action_damage_low_type;
    const tier2_type = linkedEntity.system.props.mcdm_action_damage_mid_type;
    const tier3_type = linkedEntity.system.props.mcdm_action_damage_high_type;
    const tier1_extra = linkedEntity.system.props.mcdm_action_low_text;
    const tier2_extra = linkedEntity.system.props.mcdm_action_mid_text;
    const tier3_extra = linkedEntity.system.props.mcdm_action_high_text;
    const tier1_damage_modifier = linkedEntity.system.props.mcdm_action_damage_low_modifier ?? "None";
    const tier2_damage_modifier = linkedEntity.system.props.mcdm_action_damage_mid_modifier ?? "None";
    const tier3_damage_modifier = linkedEntity.system.props.mcdm_action_damage_high_modifier ?? "None";
    const distance = linkedEntity.system.props.mcdm_action_distance;
    const target = linkedEntity.system.props.mcdm_action_target;
    const type = linkedEntity.system.props.mcdm_action_type;
    const keywords = linkedEntity.system.props.mcdm_action_keywords;
    const cost = linkedEntity.system.props.mcdm_action_cost;
    const roll_modifier = linkedEntity.system.props.mcdm_action_modifier;
    const might = entity.entity.system.props.mcdm_might ?? 0; // HACK OH MY GOD. When we don't have stats we are actually an NPC. NPC attacks use 
    const agility = entity.entity.system.props.mcdm_agility ?? 0;
    const reason = entity.entity.system.props.mcdm_reason ?? 0;
    const intuition = entity.entity.system.props.mcdm_intuition ?? 0; 
    const presence = entity.entity.system.props.mcdm_presence ?? 0;
    const trigger = linkedEntity.system.props.mcdm_action_trigger;
    const use_kit = linkedEntity.system.props.mcdm_action_kit;
    const isEnemy = entity.entity.system.props.mcdm_enemy;
    

    var html = "";
    var hasPowerRoll = rollType != 'power';
    var rollMode = game.settings.get("core", "rollMode");
    var gmUserIds = game.users.filter(user => user.isGM).map(user => user.id);

    // Begin the description block
    var showInfoBlock = keywords || distance || target || cost;
    html += `<div><i>${description}</i></div> <hr>`;

    if (showInfoBlock) {
      html += `<div>`;
      !!type ? html += `<div><b>Type:</b> ${type}<br></div>` : '';
      !!keywords ? html += `<div><b>Keywords:</b> ${keywords}<br></div>` : '';
      !!target ? html += `<div><b>Target:</b> ${target}<br></div>` : '';
      !!distance ? html += `<div><b>Distance:</b> ${distance}<br></div>` : '';
      !!trigger ? html +=  `<div><b>Trigger:</b> ${trigger}<br></div>` : '';
      html += `</div>`;
    }

    html += '<span style="display:none;">ROLL_DATA</span>';

    // Begin the table creation for damage rolls
    let tier1KitDamageBonus = 0;
    let tier2KitDamageBonus = 0;
    let tier3KitDamageBonus = 0;

    let tier1DamageText = '';
    let tier2DamageText = '';
    let tier3DamageText = '';

    if (use_kit === true) {
      switch (attack_type) {
        case ("melee"):
          tier1KitDamageBonus = tier1_melee;
          tier2KitDamageBonus = tier2_melee;
          tier3KitDamageBonus = tier3_melee;
          break;
        case ("ranged"):
          tier1KitDamageBonus = tier1_ranged;
          tier2KitDamageBonus = tier2_ranged;
          tier3KitDamageBonus = tier3_ranged;
          break;
      }
    }
    
    const tier1KitDamageBonusText = tier1KitDamageBonus != 0 ? ` + ${tier1KitDamageBonus} `: "";
    const tier2KitDamageBonusText = tier2KitDamageBonus != 0 ? ` + ${tier2KitDamageBonus} `: "";
    const tier3KitDamageBonusText = tier3KitDamageBonus != 0 ? ` + ${tier3KitDamageBonus} `: "";
    
    const GetModifier = (type) => {
      switch (type) {
        case "Might":
          return {abbreviation: "M", modifier: might};
        case "Agility":
          return {abbreviation: "A", modifier: agility};
        case "Presence":
          return {abbreviation: "P", modifier: presence};
        case "Intuition":
          return {abbreviation: "I", modifier: intuition};
        case "Reason":
          return {abbreviation: "R", modifier: reason};
        case "None":
          return {abbreviation: "", modifier: 0};
      }
    }

    const tier1Modifier = GetModifier(tier1_damage_modifier);
    const tier2Modifier = GetModifier(tier2_damage_modifier);
    const tier3Modifier = GetModifier(tier3_damage_modifier);
    
    const tier1ModifierBonusText = tier1Modifier.modifier !== 0 ? `+ ${tier1Modifier.modifier}`: "";
    const tier2ModifierBonusText = tier2Modifier.modifier !== 0 ? `+ ${tier2Modifier.modifier}`: "";
    const tier3ModifierBonusText = tier3Modifier.modifier !== 0 ? `+ ${tier3Modifier.modifier}`: "";

    if (tier1_damage != 0) {
      tier1DamageText = tier1_damage + `${tier1KitDamageBonusText} ${tier1ModifierBonusText}`.trimEnd() + ` ${tier1_type} damage;`;
    }

    if (tier2_damage != 0) {
      tier2DamageText = tier2_damage + `${tier2KitDamageBonusText} ${tier2ModifierBonusText}`.trimEnd() + ` ${tier2_type} damage;`;
    }

    if (tier3_damage != 0) {
      tier3DamageText = tier3_damage + `${tier3KitDamageBonusText} ${tier3ModifierBonusText}`.trimEnd() + ` ${tier3_type} damage;`;
    }

    var tier1Row = `<tr><td style=width:20% id=tier1>Tier1: </td><td id=tier1_damage><strong> ${tier1DamageText} ${tier1_extra}</strong></td></tr>`;
    var tier2Row = `<tr><td style=width:20% id=tier2>Tier2: </td><td id=tier2_damage><strong> ${tier2DamageText} ${tier2_extra}</strong></td></tr>`;
    var tier3Row = `<tr><td style=width:20% id=tier3>Tier3: </td><td id=tier3_damage><strong> ${tier3DamageText} ${tier3_extra}</strong></td></tr>`;

    if (rollType != 'none') {
      html += `<hr>`;
      html += `<div>`;
      html += `<table>`;
      html +=  tier1Row;
      html +=  tier2Row;
      html +=  tier3Row;
      html += `</table>`;
      html += `</div>`;
    }

// Add effect text if available
    if (title1 !== "") {
      html += `<div><strong>${title1}:</strong> ${text1}</div>`;
    }

    if (title2 !== "") {
      html += `<div><strong>${title2}:</strong> ${text2}</div>`;
    }

// Add roll button if necessary
    var costText = cost > 0 ? `(${cost})` : '';
    var flags = {};

    if (!hasPowerRoll) {
      var abilityModifier = 0;
      switch (roll_modifier) {
        case ("Might"):
          abilityModifier = might;
          break;
        case ("Agility"):
          abilityModifier = agility;
          break;
        case ("Reason"):
          abilityModifier = reason;
          break;
        case ("Intuition"):
          abilityModifier = intuition;
          break;
        case ("Presence"):
          abilityModifier = presence;
          break;
      }

      var tier_1_totalDamage = parseInt(tier1_damage) + parseInt(tier1KitDamageBonus) + parseInt(tier1Modifier.modifier);
      var tier_2_totalDamage = parseInt(tier2_damage) + parseInt(tier2KitDamageBonus) + parseInt(tier2Modifier.modifier);
      var tier_3_totalDamage = parseInt(tier3_damage) + parseInt(tier3KitDamageBonus) + parseInt(tier3Modifier.modifier);

      flags = {
        abilityRoller: {
          characteristic: roll_modifier,
          abilityModifier: isEnemy ? linkedEntity.system.props.mcdm_action_roll_bonus : parseInt(abilityModifier),
          damage: {tier_1: tier_1_totalDamage, tier_2: tier_2_totalDamage, tier_3: tier_3_totalDamage},
        }
      };

      html += `<hr><button id="rollButton">Roll!</button>`;
    }

// Construct the chat message
    let messageData = {
      flavor: `<h2><strong>${name} ${costText}</h2></strong>`,
      user: game.user._id,
      speaker: {
        alias: actorName,
        actor: game.actors.getName(actorName)
      },
      flags: flags,
      content: html
    };

    if (rollMode === "gmroll" || rollMode === "blindroll" || rollMode === "selfroll") {
      messageData.whisper = gmUserIds;
    } else if (rollMode === "publicroll") {
      messageData.whisper = [];
    }

    ChatMessage.create(messageData);
  }
  
  async importCreature(entity) {
    new Dialog({
      title: "Import data",
      content: `
        <form>
          <div style="width: 100%; max-width: 800px;">
            <label for="bigTextArea">Please enter some text:</label>
            <br>
            <textarea id="bigTextArea" style="width: 100%; height: 500px;" placeholder="Enter your multi-line text here"></textarea>
          </div>
        </form>
      `,
      buttons: {
        import: {
          label: "Import",
          callback: async (dialogHtml) => {
            const inputValue = dialogHtml.find('#bigTextArea').val();
            const enemyImporter = new EnemyImporter();
            let creature = enemyImporter.parseCreature(inputValue);
            
            let mapper = new MappingUtilities();
            await mapper.UpdateProps(entity, creature);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => {
          }
        }
      },
      default: "import",
    }).render(true, { width: 700, height: 600 });
  }
}