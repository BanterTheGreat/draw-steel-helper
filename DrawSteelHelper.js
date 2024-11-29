import {EnemyImporter} from "./EnemyImporter.js";
import {MappingUtilities} from "./MappingUtilities.js";

export class DrawSteelHelper {
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
                <label><input type="radio" name="surge" value="4"> 4</label>
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
            console.log(surges);
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
            
            const damageText = damageToTake + (surges === 0 ? "" : (" + " + "⚡".repeat(surges)));

            if (!!damageToTake && damageToTake > 0) {
              newContent += `<hr><button id="damageButton">Take ${damageText} Damage</button>`;
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
    const damage = message.flags.applyDamage;

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
      console.log(actor);
      const currentHealth = actor.system.props.mcdm_stamina_current;
      const windedHealth = actor.system.props.mcdm_stamina_winded ?? 0;
      const minHealth = actor.system.props.mcdm_stamina_winded ? -actor.system.props.mcdm_stamina_winded : 0;
      let newHealth = currentHealth - damage;
      const isNPC = actor.system.props.mcdm_enemy === "true";

      if (newHealth < minHealth) {
        newHealth = minHealth;
      }
      
      // Initialize the message array
      let messages = [];

      // Check if the character loses temporary stamina and takes damage
      if (damage > 0) {
        messages.push(`${actor.name} takes ${damage} damage, they got ${newHealth} stamina left.`);
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

  getMalice(combat) {
    const combatants = combat.combatants;
    const playerCombatants = combatants.filter(combatant => !!combatant.actor.system.props?.mcdm_class_name);
    const allVictories = playerCombatants.reduce((sum, combatant) => sum + (+combatant.actor.system.props?.mcdm_victories_current ?? 0), 0);
    const avgVictories = Math.floor(allVictories / playerCombatants.length);

    const malice = playerCombatants.length + avgVictories + combat.round + 1; // Combat round is zero indexed;

    const messageData = {
      flavor: `<h3><strong>The Battle Intensifies!</h3></strong>`,
      content: `<div>Enemies brim with dark intent as they gain <b>${malice}</b> Malice!</div>`
    };

    ChatMessage.create(messageData);
  }

  async triggerResourceRoll(combat) {
    if (!game.user.isGM) {
      return;
    }

    const currentActor = combat.combatant.actor;
    const currentActorProps = currentActor.system.props;

    if (!!currentActorProps?.mcdm_class_name) {
      let roll = await new Roll(currentActorProps?.mcdm_resource_turn ?? "1d3").evaluate({ async: true});

      const flavorText = currentActorProps?.mcdm_resource_turn_flavor ?? ` gains ${currentActorProps?.mcdm_resource}`;

      roll.toMessage({
        flavor: `<h3><strong>${currentActor.name} ${flavorText}</h3></strong>`,
        rollMode: game.settings.get("core", "rollMode"),
        speaker: {
          alias: currentActor.name,
          actor: game.actors.getName(currentActor.name)
        },
        content: `<hr><pg>${await roll.render()}</pg>`,
      });
    }
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
    const cost = linkedEntity.system.props.mcdm_action_cost;
    const distance = linkedEntity.system.props.mcdm_action_distance;
    const target = linkedEntity.system.props.mcdm_action_target;
    const keywords = linkedEntity.system.props.mcdm_action_keywords;
    const type = linkedEntity.system.props.mcdm_action_type;
    const trigger = linkedEntity.system.props.mcdm_action_trigger;
    const use_kit = linkedEntity.system.props.mcdm_action_kit;

    const collapsed = isCollapsed === true;

    let html = !!description ? `<i>${description}</i><br>` : '';

    let tier1DamageBonus = 0;
    let tier2DamageBonus = 0;
    let tier3DamageBonus = 0;

    let tier1DamageText = '';
    let tier2DamageText = '';
    let tier3DamageText = '';

    if (use_kit === true) {
      switch (attack_type) {
        case ("melee"):
          tier1DamageBonus = tier1_melee;
          tier2DamageBonus = tier2_melee;
          tier3DamageBonus = tier3_melee;
          break;
        case ("ranged"):
          tier1DamageBonus = tier1_ranged;
          tier2DamageBonus = tier2_ranged;
          tier3DamageBonus = tier3_ranged;
          break;
      }
    }
    
    if (tier1_damage != 0) {
      tier1DamageText = tier1_damage + `${tier1DamageBonus != 0 ? ` + ${tier1DamageBonus}` : ""} ${tier1_type} damage;`;
    }
    
    if (tier2_damage != 0) {
      tier2DamageText = tier2_damage + `${tier2DamageBonus != 0 ? ` + ${tier2DamageBonus}` : ""} ${tier2_type} damage;`;
    }
    
    if (tier3_damage != 0) {
      tier3DamageText = tier3_damage + `${tier3DamageBonus != 0 ? ` + ${tier3DamageBonus}` : ""} ${tier3_type} damage;`;
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
        html += rollType == 'resistance' ? `<div><i>Resistance Roll</i></div>` : '';
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

  // SocketLib helpscripts. Only used by GMs
  async deleteMessage(id) {
    const message = game.messages.get(id);
    if(message) {
      await message.delete();
    }
  }

  async updateMessage(id, newMessage) {
    const message = game.messages.get(id);
    if (message) {
      await message.update({...newMessage});

    }
  }
}