export class EnemyImporter {
    effectRegex = /^(Effect|(\d{1,2})\sMalice)(.*)/;
    triggerRegex = /Trigger (.+)/;
    targetRegex = /Target .+/;
    
    // Dangerous! Any multi line distance is completely boned.
    distanceRegex = /Distance ([\w\s×]+?) Target/;
    
    parseTriggers(lines, currentIndex) {
        let trigger = "";
        for (currentIndex; currentIndex < lines.length; currentIndex++) {
            const triggerMatch = lines[currentIndex].match(this.triggerRegex);
            const targetMatch = lines[currentIndex].match(this.targetRegex);
            const effectMatch = lines[currentIndex].match(this.effectRegex);
            const reachedDamage = lines[currentIndex].includes('★') || lines[currentIndex].includes('✸') || lines[currentIndex].includes('✦');

            // We found the start of the target.
            if (triggerMatch) {
                trigger = triggerMatch ? triggerMatch[1].trim() : null;
                continue;
            }

            // We reached the end of the target.
            if (effectMatch || reachedDamage || targetMatch) {
                break;
            }

            trigger += lines[currentIndex];
        }
        
        return {
            trigger: trigger,
            finalIndex: currentIndex
        };
    }
    
    parseTargets(lines, currentIndex) {
        let target;
        for (currentIndex; currentIndex < lines.length; currentIndex++) {
            const targetMatch = lines[currentIndex].match(this.targetRegex);
            const effectMatch = lines[currentIndex].match(this.effectRegex);
            const triggerMatch = lines[currentIndex].match(this.triggerRegex);
            const reachedDamage = lines[currentIndex].includes('★') || lines[currentIndex].includes('✸') || lines[currentIndex].includes('✦');

            // We found the start of the target.
            if (targetMatch) {
                target = targetMatch ? targetMatch[0].replace("Target ", "") : '';
                continue;
            }

            // We reached the end of the target.
            if (effectMatch || triggerMatch || reachedDamage) {
                break;
            }

            target = target.concat(" ", lines[currentIndex]);
        }
        
        return {
            target: target,
            finalIndex: currentIndex,
        }
    }
    
    parseDistance(lines, currentIndex) {
        const distanceMatch = lines[currentIndex].match(this.distanceRegex);
        return distanceMatch ? distanceMatch[1] : '';
    }
    
    parseAbility(lines, beginIndex) {
        let ability = {
            data: {
                name: "",
                actionType: "",
                diceBonus: null,
                malice: 0,
                isSignature: false,
                keywords: "",
                distance: "",
                target: "",
                trigger: "",
                tier1: null,
                tier2: null,
                tier3: null,
                effects: [],
            },
            finalIndex: beginIndex,
        }
        
        let currentIndex = beginIndex;
        
        const nameMatch = lines[currentIndex].match(/^(.+?) \(/);
        const actionTypeMatch = lines[currentIndex].match(/\((.*?)\)/);
        const diceBonusMatch = lines[currentIndex].match(/2d10 *[+-]? *\d+/);
        const maliceMatch = lines[currentIndex].match(/(\d+)\s*Malice/);
        const resistanceRollCharacteristicMatch = lines[currentIndex].match(/(\w+)\s*RR/);
        
        ability.data.name = nameMatch ? nameMatch[1] : "";
        ability.data.actionType = actionTypeMatch ? actionTypeMatch[1] : "";
        ability.data.diceBonus = diceBonusMatch ? diceBonusMatch[0].replace("2d10 + ", "") : null;
        ability.data.malice = maliceMatch ? parseInt(maliceMatch[1]) : 0;
        ability.data.isSignature = lines[currentIndex].includes("Signature");
        currentIndex += 1;
        
        // Keywords
        const keywordsMatch = lines[currentIndex].match(/Keywords (.*)/);
        
        if (keywordsMatch) {
            ability.data.keywords = keywordsMatch ? keywordsMatch[1] : '';
        }
        else if (ability.data.actionType === "Free Maneuver") {
            // Free maneuver without matches: We assume we only have text, we will parse this as the first effect it has!.
            console.log("PARSER: Found a Free Maneuver containing only text");
            ability.data.effects.push({ header: "Effect", effect: "" });
            for (currentIndex; currentIndex < lines.length; currentIndex++) {
                if (lines[currentIndex] === "") {
                    break;
                }
                
                // We just add all text we find to the first effect of the ability.
                let concatToken = ability.data.effects[0].effect === "" ? "" : " ";
                ability.data.effects[0].effect = ability.data.effects[0].effect.concat(concatToken, lines[currentIndex]);
            }

            ability.finalIndex = currentIndex ?? lines.length;
            return ability;
        }
        else {
            throw `Something went wrong with parsing. Expected either Keywords or Free Maneuver. Instead got ${lines[currentIndex]}`
        }

        currentIndex += 1;
        
        // A very annoying thing with the monsters is that at this point its either the trigger or the distance & targets.
        // As such, we gotta check and make sure what to do :(
        const distanceMatch = lines[currentIndex].match(this.distanceRegex);
        const triggerMatch = lines[currentIndex].match(this.triggerRegex);

        if (distanceMatch) {
            // Distance. We currently don't support multi line distance.
            ability.data.distance = this.parseDistance(lines, currentIndex);

            // Targets
            const parsedTarget = this.parseTargets(lines, currentIndex);
            ability.data.target = parsedTarget.target;
            currentIndex = parsedTarget.finalIndex;

            // Triggers
            const parsedTrigger = this.parseTriggers(lines, currentIndex);
            ability.data.trigger = parsedTrigger.trigger;
            currentIndex = parsedTrigger.finalIndex;
        }
        else if (triggerMatch) {
            // Triggers
            const parsedTrigger = this.parseTriggers(lines, currentIndex);
            ability.data.trigger = parsedTrigger.trigger;
            currentIndex = parsedTrigger.finalIndex;

            // Distance. We currently don't support multi line distance.
            ability.data.distance = this.parseDistance(lines, currentIndex);

            // Targets
            const parsedTarget = this.parseTargets(lines, currentIndex);
            ability.data.target = parsedTarget.target;
            currentIndex = parsedTarget.finalIndex;
        }
        else {
            throw `Something went wrong with parsing. Expected either Distance/Target or Trigger. Instead got ${lines[currentIndex]}`
        }
        
        const parseEffects = () => {
            for (currentIndex; currentIndex < lines.length; currentIndex++) {
                if (lines[currentIndex] === "") {
                    break;
                }

                // We spot power roll icons. We are done with effects.
                if (lines[currentIndex].includes("★") || lines[currentIndex].includes("✦") || lines[currentIndex].includes("✸")) {
                    break;
                }

                // Check if the sentence begins with Effect or a malice cost.
                let match = lines[currentIndex].match(this.effectRegex);

                // Beginning of effect
                if (match) {
                    effectIndex += 1;
                    let header = match[1];
                    let effect = match[3].trim();
                    ability.data.effects.push({ header: header, effect: effect  })
                    continue;
                }

                // Not a match? Must be continuing last effect.
                ability.data.effects[effectIndex].effect = ability.data.effects[effectIndex].effect.concat(" ", lines[currentIndex]);
            }
        }

        let effectIndex = -1;
        console.log("PARSER: Parsing effects before the power roll.")
        // Sometimes, effects are before the power roll. Very very annoying.
        parseEffects();

        
        // We got a roll bonus or we are a resistance roll, so we got a roll.
        console.log("PARSER: Parsing the power roll.")
        if (ability.data.diceBonus !== null) {
            // Tier 1;
            ability.data.tier1 = this.parseTier(lines, currentIndex, ['★', '✦', '✸']);
            // Tier 2;
            ability.data.tier2 = this.parseTier(lines, ability.data.tier1.finalIndex, ['★', '✦', '✸']);
            // Tier 3;
            ability.data.tier3 = this.parseTier(lines, ability.data.tier2.finalIndex, ['Effect', 'Malice']);
            currentIndex = ability.data.tier3.finalIndex;  
        }
        
        // Get the remaining effects.
        console.log("PARSER: Parsing effects after the power roll.")
        parseEffects();
        
        ability.finalIndex = currentIndex ?? lines.length;
        
        return ability;
    }
    
    parseTier(lines, beginIndex, endWhenPresent) {
        let damageAmount = null;
        let type = '';
        let effect = '';
        let finalIndex = null;
        
        for (let i = beginIndex; i < lines.length; i++) {
            let line = lines[i];
            let exit = false;

            // We have reached the end of our damage section. Quit.
            endWhenPresent.forEach(end =>
            {
                if (line.includes(end) && i !== beginIndex) {
                    exit = true;
                }
            });
            
            if (exit || lines[i] === "") {
                finalIndex = i;
                break;
            }

            // This is the first loop. 
            if (damageAmount === null) {
                let cleanedLine = lines[i].replace(/^\D*\s*(≤11|12–16|17\+?)\s*/, "").trim()
                const damageMatch = cleanedLine.match(/(\d+)\s*(\w+)?\s*damage/);
                damageAmount = damageMatch ? parseInt(damageMatch[1]) : 0;
                type = damageMatch ? damageMatch[2] : '';
                
                // If we got no damage, we can't just grab everything after the damage dotcomma. We just take the entire sentence instead.
                if (damageAmount !== 0) {
                    let effectMatch = cleanedLine.match(/damage;\s*(.*)/);
                    effect = effectMatch ? effectMatch[1].trim() : '';
                } else {
                    effect = cleanedLine;
                }
                
                continue;
            }
            
            // It's no longer the first loop. Just start copying text.
            effect = effect.concat(' ',line);
        }
        
        return {
            result: {
                damageAmount: damageAmount ?? 0,
                type: type,
                effect: effect,
            },
            finalIndex: finalIndex ?? lines.length,
        }
    }
    
    parsePassive(lines, beginIndex) {
        const name = lines[beginIndex];
        let description = "";
        let finalIndex = null;
        
        for (let i = beginIndex + 1; i < lines.length; i++) {
            let line = lines[i];
            
            if (line === "") {
                finalIndex = i;
                break;
            }
            
            description = description.concat(' ', lines[i].replace("\n", ""));
        }
        
        return {
            passive: {
                name: name,
                description: description,
            },
            finalIndex: finalIndex ?? lines.length,
        }
    }
    
    parseCreature(creatureText){
        const creature = {
            name: null,
            level: null,
            type: null,
            traits: null,
            ev: null,
            stamina: null,
            immunities: null,
            weaknesses: null,
            speed: null,
            size: null,
            stability: null,
            freeStrike: null,
            characteristics: {
                might: null,
                agility: null,
                reason: null,
                intuition: null,
                presence: null,
            },
            passives: [],
            abilities: [],
        }
        
        try {
            const lines = creatureText.split('\n').map(line => line.trim());
            console.log(lines);

            // Header
            const header = lines[0].match(/^([A-Za-z\s]+) LEVEL (\d+) ([A-Za-z\s]+)$/);
            creature.name = header[1].trim();
            creature.level = parseInt(header[2].trim());
            creature.type = header[3].trim();

            // Traits and EV
            const traitAndEV = lines[1].match(/^(.*?)(?:\sEV\s)(\d+)(?:\s.*)?$/);
            creature.traits = traitAndEV[1].trim();
            creature.ev = parseInt(traitAndEV[2]);

            // Stamina & Immunities
            const staminaAndImmunities = lines[2];
            const staminaMatch = staminaAndImmunities.match(/Stamina (\d+)/); // Extract Stamina value
            const immunityMatch = staminaAndImmunities.match(/Immunity (.*)/); // Extract Immunities if present
            const weaknessMatch = staminaAndImmunities.match(/Weakness (.*)/); // Extract Immunities if present

            creature.stamina = staminaMatch ? parseInt(staminaMatch[1]) : 0;
            creature.immunities = immunityMatch ? immunityMatch[1].trim() : "";
            creature.weaknesses = weaknessMatch ? weaknessMatch[1].trim() : "";

            // Speed, Size & Stability
            const speedSizeAndStability = lines[3];
            const speedMatch = speedSizeAndStability.match(/Speed (\d+)/);
            const sizeMatch = speedSizeAndStability.match(/Size (\d+[MS]?)/);
            const stabilityMatch = speedSizeAndStability.match(/Stability (-?\d+)/);

            creature.speed = speedMatch ? parseInt(speedMatch[1]) : 0;
            creature.size = sizeMatch ? sizeMatch[1].trim() : "1M";
            creature.stability = stabilityMatch ? parseInt(stabilityMatch[1]) : 0;

            // Free Strike
            const freeStrikeSection = lines[4];
            const freeStrikeMatch = freeStrikeSection.match(/Free Strike (\d+)/);

            creature.freeStrike = freeStrikeMatch ? parseInt(freeStrikeMatch[1]) : 0;

            // Characteristics
            const characteristics = lines[5];
            const mightMatch = characteristics.match(/Might ([+-−]?\d+)/);
            const agilityMatch = characteristics.match(/Agility ([+-−]?\d+)/);
            const reasonMatch = characteristics.match(/Reason ([+-−]?\d+)/);
            const intuitionMatch = characteristics.match(/Intuition ([+-−]?\d+)/);
            const presenceMatch = characteristics.match(/Presence ([+-−]?\d+)/);

            const parseValue = value => parseInt(value.replace('−', '-'));

            creature.characteristics.might = mightMatch ? parseValue(mightMatch[1]) : 0;
            creature.characteristics.agility = agilityMatch ? parseValue(agilityMatch[1]) : 0;
            creature.characteristics.reason = reasonMatch ? parseValue(reasonMatch[1]) : 0;
            creature.characteristics.intuition = intuitionMatch ? parseValue(intuitionMatch[1]) : 0;
            creature.characteristics.presence = presenceMatch ? parseValue(presenceMatch[1]) : 0;

            // Actions, Passives and Villain Actions.
            for (let i = 6; i < lines.length; i++) {
                const actionTypeMatch = lines[i].match(/\((.*?)\)/);
                const actionType = actionTypeMatch ? actionTypeMatch[1] : "";
                
                if (actionType === "") {
                    const passiveData = this.parsePassive(lines, i);
                    i = passiveData.finalIndex;
                    creature.passives.push(passiveData.passive);
                } else {
                    const abilityData = this.parseAbility(lines, i);
                    i = abilityData.finalIndex;
                    creature.abilities.push(abilityData.data);
                }
            }
        } catch (error) {
            ui.notifications.error(error.toString());
            ui.notifications.error("Something went wrong parsing to JSON");
            console.error(creature);
            throw error;
        }
        
        return creature;
    }
}
