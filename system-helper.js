export class SystemHelper {
    static replaceConditionList() {
        const effectsToDelete = [
            'unconscious',
            'sleep',
            'stun',
            'prone',
            'restrain',
            'paralysis',
            'deaf',
            'silence',
            'fear',
            'burning',
            'frozen',
            'shock',
            'corrode',
            'bleeding',
            'disease',
            'poison',
            'curse',
            'regen',
            'degen',
            'upgrade',
            'downgrade',
            'target',
            'eye',
            'bless',
            'fireShield',
            'coldShield',
            'magicShield',
            'holyShield'
        ];

        const newEffects = [
            {id: 'bleeding', name: 'Bleeding', img: 'icons/svg/blood.svg'},
            {id: 'dazed', name: 'Dazed', img: 'icons/svg/daze.svg'},
            {id: 'frightened', name: 'Frightened', img: 'icons/svg/terror.svg'},
            {id: 'grabbed', name: 'Grabbed', img: 'icons/svg/net.svg'},
            {id: 'prone', name: 'Prone', img: 'icons/svg/falling.svg'},
            {id: 'restrained', name: 'Restrained', img: 'icons/svg/net.svg'},
            {id: 'slowed', name: 'Slowed', img: 'icons/svg/degen.svg'},
            {id: 'taunted', name: 'Taunted', img: 'icons/svg/target.svg'},
            {id: 'weakened', name: 'Weakened', img: 'icons/svg/poison.svg'},
            {id: 'judged', name: 'Judged', img: 'icons/svg/bones.svg'},
            {id: 'stats-down', name: 'Stats Down', img: 'icons/svg/down.svg'},
            {id: 'stats-up', name: 'Stats Up', img: 'icons/svg/up.svg'},
            {id: 'disguised', name: 'Disguised', img: 'icons/svg/mystery-man.svg'}
        ];

        CONFIG.statusEffects = CONFIG.statusEffects.filter(x => !effectsToDelete.includes(x.id));
        CONFIG.statusEffects = CONFIG.statusEffects.concat(newEffects);
    }
}