/**
 * «¿Qué leo?»: entiende cómo venís (texto libre) y elige un libro de la biblioteca.
 * No usa ninguna API ni manda nada a ningún lado: interpreta el texto con un vocabulario
 * de ánimos y lo cruza con el perfil de cada libro (src/datos/perfiles.json), la hora y el clima.
 */
import type { Libro } from './datos/tipos';
import { hash, rng } from './util/aleatorio';

export const TONOS = [
  'pensar',
  'emocion',
  'melancolia',
  'liviano',
  'humor',
  'intriga',
  'aventura',
  'oscuro',
  'amor',
  'aprender',
  'impulso',
  'poesia',
  'calma',
] as const;
export type Tono = (typeof TONOS)[number];
type Tonos = Partial<Record<Tono, number>>;

export interface Perfil {
  tonos: Tonos;
  temas: string[];
  /** Qué tan duro es emocionalmente (0 a 1). */
  pesado?: number;
  /** Libro de consulta o estudio: solo aparece si se lo pide por tema o por nombre. */
  referencia?: boolean;
  /** Momentos de la vida o sentimientos para los que este libro es especialmente bueno. */
  momentos?: string[];
  frase: string;
  /** En antologías y libros de cuentos: cada obra de adentro, para recomendar una concreta. */
  obras?: Obra[];
}

/** Una obra dentro de un libro (un cuento, una novela de una antología…). */
export interface Obra {
  titulo: string;
  /** «cuento», «novela corta», «novela», «crónica»… */
  tipo: string;
  largo: 'corto' | 'medio' | 'largo';
  tonos: Tonos;
  frase: string;
  momentos?: string[];
  temas?: string[];
  pesado?: number;
}

/** Grosor equivalente (cm) según el largo de una obra, para comparar con los libros enteros. */
const GROSOR_OBRA = { corto: 1, medio: 1.8, largo: 3.4 } as const;

export interface ContextoLectura {
  /** Hora de Buenos Aires, 0 a 24. */
  hora: number;
  /** Lluvia afuera, 0 a 1. */
  lluvia: number;
}

export interface Recomendacion {
  libro: Libro;
  /** Si el libro es una antología: qué leer concretamente adentro. */
  obra?: { titulo: string; tipo: string };
  /** Frase corta, manuscrita, de por qué este. */
  intro: string;
  porque: string;
}

type Estado = 'releer' | 'nuevo' | 'retomar';

/** Qué libros considerar según si ya los leí. */
export type Cuales = 'todos' | 'sin-leer' | 'empezado' | 'leido';

interface Efecto {
  t?: Tonos;
  tema?: string;
  /** Un momento de la vida o un sentimiento («sin rumbo», «corazón roto», «etapa nueva»…). */
  momento?: string;
  largo?: 'corto' | 'largo';
  estado?: Estado;
  /** Positivo: quiere algo intenso; negativo: mejor nada muy duro. */
  pesado?: number;
  azar?: number;
}

/**
 * Momentos de la vida y sentimientos: además de mover los tonos, cada uno tiene libros que
 * «saben» de eso (campo `momentos` en perfiles.json) y una frase con la que la biblioteca responde.
 */
const INTRO_MOMENTO: Record<string, string> = {
  perdido: 'Para cuando uno se siente sin rumbo',
  empezar: 'Para una etapa que empieza',
  ruptura: 'Para curar el corazón',
  enamorado: 'Para cuando hay mariposas',
  duelo: 'Para acompañar una pérdida',
  cabeza: 'Para calmar la cabeza',
  estancado: 'Para salir del pozo y moverse',
  soledad: 'Para que la soledad pese menos',
  nostalgia: 'Para mirar atrás con cariño',
  existencial: 'Para las preguntas grandes',
  camino: 'Para buscar tu propio camino',
  agotado: 'Para descansar el alma',
  feliz: 'Para acompañar la buena racha',
  bronca: 'Para canalizar la bronca',
  examenes: 'Para un recreo entre apuntes',
  viaje: 'Para llevar de viaje',
  trabajo: 'Para olvidarte del laburo un rato',
  familia: 'Para pensar en los tuyos',
  raro: 'Para los días raros',
  envion: 'Para aprovechar el envión',
  bajon: 'Para acompañar el bajón',
};

/**
 * Vocabulario: cada entrada tiene raíces (el texto ya va sin tildes y en minúscula).
 * - `=palabra` tiene que coincidir entera.
 * - Con espacios es una frase y se busca tal cual.
 * - El resto es el comienzo de una palabra («trist» sirve para triste, tristeza…).
 * Las frases se buscan primero; después, palabra por palabra gana la primera entrada que coincide.
 */
const VOCABULARIO: [string[], Efecto][] = [
  // Frases
  [['no se', 'ni idea', 'lo que sea', 'elegi vos', 'elegime', 'decidi vos'], { azar: 1 }],
  [['no puedo dormir', 'antes de dormir', 'para dormir'], { t: { calma: 0.8, liviano: 0.5 }, pesado: -0.4 }],
  [['sin pensar', 'cortar la cabeza', 'apagar la cabeza', 'no pensar'], { t: { liviano: 1, humor: 0.3, pensar: -0.6 }, pesado: -0.3 }],
  [['bajar un cambio'], { t: { calma: 1, liviano: 0.4 }, pesado: -0.4 }],
  [['que me atrape', 'no poder soltar', 'no pueda soltar', 'que no pueda parar', 'de un tiron'], { t: { intriga: 1, aventura: 0.3 } }],
  [['que me toque', 'me haga llorar', 'que me emocione', 'que me abrace', 'me abrace'], { t: { emocion: 1, melancolia: 0.3, calma: 0.2 } }],
  [['de nuevo', 'otra vez', 'volver a leer', 'ya lei'], { estado: 'releer' }],
  [['nunca lei', 'no lei', 'sin leer', 'algo nuevo'], { estado: 'nuevo' }],
  [['a medias', 'a mitad', 'que deje', 'que empece', 'seguir con'], { estado: 'retomar' }],
  [['poco tiempo', 'un rato', 'sala de espera', 'viaje corto'], { largo: 'corto' }],
  [['fin de semana', 'el finde', 'tengo tiempo', 'tiempo de sobra', 'para semanas'], { largo: 'largo' }],
  [['bien escrito', 'bien escrita'], { t: { poesia: 1 } }],
  [['buenos aires'], { tema: 'argentina' }],
  [['inteligencia artificial'], { tema: 'futuro' }],
  [['cultura general', 'que me deje algo'], { t: { aprender: 1, pensar: 0.3 } }],
  [['marco aurelio'], { tema: 'filosofia' }],

  // Momentos de la vida y sentimientos (frases)
  [['me siento perdido', 'me siento perdida', 'sin rumbo', 'no se que hacer con mi vida', 'no se que quiero', 'no encuentro mi lugar', 'fuera de lugar', 'no se quien soy', 'no se a donde voy'], { momento: 'perdido', t: { pensar: 0.6, impulso: 0.5, emocion: 0.4, calma: 0.3 } }],
  [['etapa nueva', 'nueva etapa', 'me mude', 'me estoy mudando', 'cambio de vida', 'nuevo trabajo', 'trabajo nuevo', 'empezar de cero', 'de cero', 'primer ano', 'empiezo la facu', 'empece la facu', 'me recibi', 'nuevo comienzo'], { momento: 'empezar', t: { impulso: 0.8, pensar: 0.3, aventura: 0.3 } }],
  [['corazon roto', 'rompieron el corazon', 'me rompieron', 'me dejaron', 'me dejo', 'me corto', 'corte con', 'termine con', 'mi ex', 'me separe'], { momento: 'ruptura', t: { amor: 0.5, melancolia: 0.6, emocion: 0.5, impulso: 0.3 }, pesado: -0.2 }],
  [['me gusta alguien', 'conoci a alguien', 'estoy saliendo con', 'hay alguien'], { momento: 'enamorado', t: { amor: 1, poesia: 0.4, emocion: 0.3, liviano: 0.2 } }],
  [['perdi a', 'se murio', 'se fue mi', 'extrano a alguien', 'perdida de'], { momento: 'duelo', t: { emocion: 0.8, melancolia: 0.6, calma: 0.5, pensar: 0.4 }, pesado: -0.3 }],
  [['cabeza a mil', 'mil pensamientos', 'miedo al futuro', 'no se que va a pasar', 'mucha presion'], { momento: 'cabeza', t: { calma: 1, pensar: 0.3, liviano: 0.4 }, pesado: -0.5 }],
  [['no avanzo', 'sin motivacion', 'la rutina', 'aburrido de', 'aburrida de', 'quiero cambiar', 'quiero mejorar', 'ponerme las pilas'], { momento: 'estancado', t: { impulso: 1, pensar: 0.3 } }],
  [['me siento solo', 'me siento sola', 'estoy solo', 'estoy sola', 'nadie me entiende', 'sin amigos'], { momento: 'soledad', t: { emocion: 0.7, melancolia: 0.4, calma: 0.3, humor: 0.2 }, pesado: -0.6 }],
  [['mi infancia', 'cuando era chico', 'cuando era chica', 'de chico', 'de chica', 'me estoy haciendo grande', 'cumpli anos'], { momento: 'nostalgia', t: { melancolia: 0.7, emocion: 0.5, poesia: 0.4 } }],
  [['sentido de la vida', 'para que estamos', 'la muerte', 'la felicidad', 'el sentido', 'el tiempo pasa'], { momento: 'existencial', t: { pensar: 1, emocion: 0.3 } }],
  [['mis suenos', 'cumplir mis', 'mi proposito', 'mi camino', 'que quiero ser', 'que estudiar', 'mi lugar en el mundo', 'encontrarme'], { momento: 'camino', t: { impulso: 0.8, aventura: 0.4, pensar: 0.4 } }],
  [['no doy mas', 'necesito un descanso', 'sin energia', 'sin pilas', 'sin animo', 'sin ganas'], { momento: 'agotado', t: { liviano: 0.9, calma: 0.7, humor: 0.4 }, pesado: -0.7 }],
  [['buena racha', 'todo bien', 're bien', 'de buen humor', 'muy bien'], { momento: 'feliz', t: { aventura: 0.6, humor: 0.5, liviano: 0.4, amor: 0.3 } }],
  [['estoy estudiando', 'tengo que rendir', 'estoy rindiendo'], { momento: 'examenes', t: { liviano: 0.7, humor: 0.3, calma: 0.3 }, pesado: -0.4 }],
  [['me voy de viaje', 'de vacaciones', 'la costa', 'en el avion'], { momento: 'viaje', t: { aventura: 0.8, liviano: 0.6, intriga: 0.5 } }],
  [['mi jefe', 'el laburo', 'del laburo', 'el trabajo', 'del trabajo'], { momento: 'trabajo', t: { liviano: 0.6, humor: 0.5, calma: 0.4 } }],
  [['mi viejo', 'mi vieja', 'mis viejos', 'mi familia', 'mi papa', 'mi mama', 'mi hermano', 'mi hermana', 'mis abuelos', 'mi abuelo', 'mi abuela'], { momento: 'familia', tema: 'familia', t: { emocion: 0.6, pensar: 0.3 } }],
  [['dia raro', 'me siento raro', 'me siento rara', 'todo raro'], { momento: 'raro', t: { poesia: 0.7, pensar: 0.4, humor: 0.3 } }],
  [['con todo', 'me siento fuerte', 'con energia', 'con ganas', 'a full'], { momento: 'envion', t: { impulso: 0.7, aventura: 0.6, intriga: 0.3 } }],

  // Momentos y sentimientos (palabras)
  [['perdid', 'desorientad', 'confundid', 'crisis'], { momento: 'perdido', t: { pensar: 0.6, impulso: 0.5, emocion: 0.4, calma: 0.3 } }],
  [['empiezo', 'empezando', 'arranco', 'arrancando', 'mudanza', 'mudarme'], { momento: 'empezar', t: { impulso: 0.8, pensar: 0.3, aventura: 0.3 } }],
  [['ruptura', 'separacion', 'separe', 'cortamos', 'terminamos', 'desamor', 'despecho', 'tusa', '=ex'], { momento: 'ruptura', t: { amor: 0.5, melancolia: 0.6, emocion: 0.5, impulso: 0.3 }, pesado: -0.2 }],
  [['enamor', 'mariposas', 'crush'], { momento: 'enamorado', t: { amor: 1, poesia: 0.4, emocion: 0.3, liviano: 0.2 } }],
  [['=duelo', 'fallec', 'murio', 'muerte'], { momento: 'duelo', t: { emocion: 0.8, melancolia: 0.6, calma: 0.5, pensar: 0.4 }, pesado: -0.3 }],
  [['ansie', 'ansios', 'estres', 'abrum', 'agobi', 'sobrepens', 'overthink', 'incertidumbre', 'preocupad', 'presion'], { momento: 'cabeza', t: { calma: 1, pensar: 0.3, liviano: 0.4 }, pesado: -0.5 }],
  [['estancad', 'procrastin', 'desmotivad', 'aburrid'], { momento: 'estancado', t: { impulso: 1, pensar: 0.3 } }],
  [['soledad', 'aislad', 'incomprendid'], { momento: 'soledad', t: { emocion: 0.7, melancolia: 0.4, calma: 0.3, humor: 0.2 }, pesado: -0.6 }],
  [['nostalg', 'infancia', 'recuerd', 'extran'], { momento: 'nostalgia', t: { melancolia: 0.7, emocion: 0.5, poesia: 0.4 } }],
  [['existencial', 'existenc'], { momento: 'existencial', t: { pensar: 1, emocion: 0.3 } }],
  [['proposito', 'vocacion', 'suenos'], { momento: 'camino', t: { impulso: 0.8, aventura: 0.4, pensar: 0.4 } }],
  [['cansad', 'agotad', 'fundid', 'quemad', 'reventad', 'burnout', 'exhaust'], { momento: 'agotado', t: { liviano: 0.9, calma: 0.7, humor: 0.4 }, pesado: -0.7 }],
  [['feliz', 'contento', 'contenta', 'festej', 'celebr', 'alegr'], { momento: 'feliz', t: { aventura: 0.6, humor: 0.5, liviano: 0.4, amor: 0.3 } }],
  [['enojad', 'bronca', 'injust', 'calient', '=harto', '=harta', 'podrid', 'furi', 'rabia'], { momento: 'bronca', t: { pensar: 0.5, intriga: 0.5, oscuro: 0.3 } }],
  [['parcial', 'examen', 'rendir', '=rindo', '=final', '=finales', 'apuntes'], { momento: 'examenes', t: { liviano: 0.7, humor: 0.3, calma: 0.3 }, pesado: -0.4 }],
  [['vacacion', '=avion', '=playa', 'mochila'], { momento: 'viaje', t: { aventura: 0.8, liviano: 0.6, intriga: 0.5 } }],
  [['laburo', 'trabajo', 'oficina', 'reunion'], { momento: 'trabajo', t: { liviano: 0.6, humor: 0.5, calma: 0.4 } }],
  [['=raro', '=rara'], { momento: 'raro', t: { poesia: 0.7, pensar: 0.4, humor: 0.3 } }],
  [['imparable', 'motivad', 'enchufad'], { momento: 'envion', t: { impulso: 0.7, aventura: 0.6, intriga: 0.3 } }],
  [['trist', 'bajon', 'melancol', 'deprim', 'angust', 'desanim', 'apagad', '=mal', 'vacio', 'desilusion', 'decaid', 'lloro', 'llorando'], { momento: 'bajon', t: { melancolia: 0.6, emocion: 0.5, impulso: 0.3, calma: 0.3 }, pesado: -0.5 }],

  // Ánimos
  [['llor', 'emocion', 'conmov', 'sensibl', 'tiern', 'ternura', '=sentir', 'sentimient'], { t: { emocion: 1, melancolia: 0.3 } }],
  [['pens', 'reflex', 'profund', 'pregunta', 'cuestion', 'sentido'], { t: { pensar: 1, aprender: 0.2 } }],
  [['livian', 'ligero', 'ligerit', 'facil', 'simple', 'tranqui', 'relaj', 'descans', 'desconect', '=light', 'pavada', 'entreten', 'pasatiempo', '=leve'], { t: { liviano: 1, humor: 0.3, calma: 0.2 }, pesado: -0.3 }],
  [['=reir', 'reirme', '=risa', 'risas', 'gracios', 'divert', 'humor', 'chiste', '=joda', 'carcaj', 'comedi', 'absurd'], { t: { humor: 1, liviano: 0.5 } }],
  [['suspens', 'misteri', 'intriga', 'atrap', 'engan', 'adict', 'devor', '=giros', 'enigm'], { t: { intriga: 1, aventura: 0.2 } }],
  [['policial', 'detectiv', 'crimen', 'asesin', 'thriller', 'investig'], { t: { intriga: 1 }, tema: 'policial' }],
  [['aventur', 'viaj', 'escap', 'epic', 'accion', 'tesoro', 'emocionant'], { t: { aventura: 1, intriga: 0.3 } }],
  [['ladron', '=robo', '=robos', '=golpe', 'lupin', 'arsene'], { t: { aventura: 0.8, intriga: 0.5 }, tema: 'lupin' }],
  [['miedo', 'terror', 'horror', 'fantasm', 'sobrenatural', 'escalofr'], { t: { oscuro: 1, intriga: 0.4 }, tema: 'terror' }],
  [['oscur', 'inquiet', 'perturb', 'macabr', 'sinies', '=sangre', 'tenebr', '=dark', 'retorcid'], { t: { oscuro: 1, intriga: 0.3 } }],
  [['amor', 'romant', 'romance', '=pareja', 'vincul', 'relacion', '=beso', '=besos', 'corazon'], { t: { amor: 1, emocion: 0.3 } }],
  [['aprend', 'estudi', 'conocimient', 'entend', 'curios', '=dato', '=datos', '=saber', 'informar', 'ensayo'], { t: { aprender: 1, pensar: 0.3 } }],
  [['motiv', 'inspir', '=animo', 'animarme', 'energi', '=fuerza', 'cambiar', 'crecer', 'mejorar', 'disciplin', 'empuj', 'objetivo', '=meta', '=metas', 'exito', 'emprend', 'arrancar', 'levantar', 'enfoc', 'superar'], { t: { impulso: 1, liviano: 0.2 } }],
  [['poesi', 'poet', '=verso', 'versos', '=bello', 'bella', 'belleza', 'prosa', 'lenguaje', 'literari'], { t: { poesia: 1 } }],
  [['=lindo', '=linda', 'algo lindo'], { t: { poesia: 0.5, emocion: 0.4, liviano: 0.3 } }],
  [['calma', '=paz', 'seren', 'nervi', 'medit', 'respir', 'silenci', 'paciencia'], { t: { calma: 1, liviano: 0.4 }, pesado: -0.5 }],
  [['dormir', '=sueno', '=cama', 'insomni'], { t: { calma: 0.7, liviano: 0.5 }, pesado: -0.3 }],
  [['intens', '=fuerte', '=duro', '=dura', 'impact', 'removed'], { t: { emocion: 0.4 }, pesado: 0.7 }],

  // Largo
  [['=corto', '=corta', 'cortit', '=rapido', 'rapidit', '=breve', '=bondi', 'colectivo', '=subte', '=tren', '=ratito'], { largo: 'corto' }],
  [['=largo', '=larga', 'finde', 'atrapante largo'], { largo: 'largo' }],

  // Qué tipo de lectura
  [['releer', 'favorit'], { estado: 'releer' }],
  [['=nuevo', 'pendient', 'distint', 'descubrir'], { estado: 'nuevo' }],
  [['terminar', 'retomar', 'empezad', 'continuar'], { estado: 'retomar' }],
  [['sorprend', 'cualquier', '=random', '=azar', 'sorpresa'], { azar: 1 }],

  // Temas
  [['ajedre', '=chess', '=jaque'], { tema: 'ajedrez', t: { aprender: 0.3 } }],
  [['futbol', '=fulbo', 'cancha', '=pelota', 'mundial', '=messi'], { tema: 'futbol' }],
  [['=plata', 'dinero', 'finanz', 'invert', 'inversion', 'ahorr', 'econom', '=guita'], { tema: 'dinero', t: { aprender: 0.4 } }],
  [['program', 'codigo', 'software', '=dev', 'informatic'], { tema: 'programacion', t: { aprender: 0.4 } }],
  [['cienc', 'biolog', 'fisic', 'natur', 'quimic', '=eureka'], { tema: 'ciencia', t: { aprender: 0.5 } }],
  [['histori', '=pasado', 'antigu'], { tema: 'historia', t: { aprender: 0.4 } }],
  [['argentin', 'porten', '=nacional', '=nuestro', '=nuestra', 'latinoameric'], { tema: 'argentina' }],
  [['dictadura', '=memoria', 'desaparec'], { tema: 'memoria' }],
  [['=dios', '=fe', 'espiritu', 'religi', 'biblia', '=rezar', '=orar', '=alma'], { tema: 'espiritual', t: { calma: 0.3 } }],
  [['psico', 'terap', '=mente', '=cabeza'], { tema: 'psicologia', t: { pensar: 0.3 } }],
  [['filosof', 'estoic', 'sabidur', '=platon'], { tema: 'filosofia', t: { pensar: 0.5 } }],
  [['distop', '=futuro', 'tecnolog', '=ia', 'robot'], { tema: 'futuro', t: { pensar: 0.3 } }],
  [['politic', '=poder', 'estrateg', 'liderazg', '=lider', 'negocio', 'gobiern'], { tema: 'poder' }],
  [['=salud', 'entren', 'gimnas', '=gym', '=comida', 'nutri', '=dieta', 'rutina', 'habito', 'productiv', 'organiz'], { tema: 'habitos', t: { impulso: 0.4 } }],
  [['=facu', 'facultad', '=cbc', '=uba', 'universidad', '=carrera'], { tema: 'facultad', t: { aprender: 0.4 } }],
  [['cuento', 'relato'], { tema: 'cuentos', largo: 'corto' }],
  [['clasic'], { tema: 'clasico' }],
  [['juvenil', 'adolesc'], { tema: 'juvenil' }],
  [['guerra', '=nazi', '=nazis', 'holocaust'], { tema: 'guerra' }],
  [['familia', '=padre', '=madre', 'hermano', 'hermana', '=papa', '=mama'], { tema: 'familia', t: { emocion: 0.3 } }],
  [['amig', '=gente', 'social', 'persuad', 'comunic', 'convencer'], { tema: 'social' }],
];

const NEGACIONES = new Set(['no', 'nada', 'sin', 'ni', 'tampoco', 'evitar', 'evito', 'basta', 'cero']);

/** Palabras de títulos y autores que no alcanzan para decir «quiero ese libro». */
const COMUNES = new Set([
  'para', 'como', 'sobre', 'entre', 'libro', 'libros', 'algo', 'quiero', 'tengo', 'estoy', 'ando', 'leer', 'ganas',
  'dame', 'unos', 'unas', 'este', 'esta', 'esto', 'mucho', 'poco', 'pero', 'porque', 'cuando', 'donde', 'todo', 'toda',
  'todos', 'otra', 'otro', 'mismo', 'desde', 'hasta', 'hace', 'hacer', 'noche', 'vida', 'hombre', 'mundo', 'arte',
  'lluvia', 'fuego', 'cosas', 'gente', 'normal', 'nieve', 'viento', 'nombre', 'sentido', 'cristal', 'historia',
  'principio', 'biblioteca', 'mujer', 'chica', 'cartas', 'despues', 'volver', 'empezar', 'parte', 'nuestra', 'edicion',
  'completa', 'narrativa', 'lecciones', 'siglo', 'santa', 'verdes', 'sonrisas', 'perdimos', 'existencia', 'personas',
  'influir', 'ganar', 'amigos', 'hueca', 'aguja', 'contra', 'iniciacion', 'gimnasio', 'neuronas', 'permanencia',
  'fundamentos', 'mercado', 'capitales', 'manual', 'especialistas', 'codigo', 'limpio', 'campana', 'feliz', 'rico',
  'busca', 'efimero', 'asumir', 'metodo', 'atomicos', 'habitos', 'vendio', 'monje', 'ladron', 'caballero', 'espera',
  'universidad', 'buenos', 'aires', 'sociedades', 'biblicas', 'unidas', 'informe', 'lado', 'encuentros', 'medianoche',
  'paciente', 'silenciosa', 'princesa', 'conoce', 'imita', 'disfruta', 'ocio', 'padecientes', 'cabalas', 'futbol',
  'barnes', 'schnek', 'george', 'gabriel', 'maria', 'robert', 'julio', 'mario', 'james', 'carlos', 'jose', 'raul',
  'maurice', 'yuval', 'noah', 'sally', 'stephen', 'javier', 'colleen', 'isabel', 'oscar', 'ernesto', 'viktor', 'dale',
  'paulo', 'german', 'ricardo', 'antonio', 'garry', 'alex', 'matt', 'aldous', 'sylvia', 'mariana', 'nicolas', 'beltran',
  'robin', 'rodolfo', 'maximiliano', 'fernanda', 'clear',
]);

const INTRO_TONO: Record<Tono, (c: { lluvia: boolean; noche: boolean }) => string> = {
  pensar: () => 'Para pensar un rato',
  emocion: () => 'Para dejarte conmover',
  melancolia: (c) => (c.lluvia ? 'Para una tarde gris' : 'Para acompañar el bajón'),
  liviano: () => 'Liviano, sin esfuerzo',
  humor: () => 'Para reírte un poco',
  intriga: () => 'Para no poder soltarlo',
  aventura: () => 'Para escaparte un rato',
  oscuro: (c) => (c.noche ? 'Para un escalofrío nocturno' : 'Para un buen escalofrío'),
  amor: () => 'Para el corazón',
  aprender: () => 'Para aprender algo',
  impulso: () => 'Para arrancar con ganas',
  poesia: () => 'Por cómo está escrito',
  calma: (c) => (c.noche ? 'Para antes de dormir' : c.lluvia ? 'Para escuchar la lluvia y bajar un cambio' : 'Para bajar un cambio'),
};

const INTRO_TEMA: Record<string, string> = {
  ajedrez: 'Para tu lado ajedrecista',
  futbol: 'Para los futboleros',
  dinero: 'Para ordenar la plata',
  programacion: 'Para programar mejor',
  ciencia: 'Para tu lado científico',
  historia: 'Para viajar al pasado',
  argentina: 'Bien de acá',
  memoria: 'Para la memoria',
  espiritual: 'Para el alma',
  psicologia: 'Para entender la cabeza',
  filosofia: 'Para filosofar un rato',
  futuro: 'Para pensar el futuro',
  poder: 'Sobre el poder',
  habitos: 'Para ordenar la rutina',
  facultad: 'Para la facu',
  cuentos: 'En cuentos cortos',
  clasico: 'Un clásico',
  terror: 'Para un buen escalofrío',
  policial: 'Un buen misterio',
  romance: 'Para el corazón',
  juvenil: 'Juvenil y tierno',
  lupin: 'Para seguir con Lupin',
  guerra: 'Sobre la guerra',
  familia: 'Sobre la familia',
  social: 'Para la gente que te rodea',
};

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface Pedido {
  tonos: Record<Tono, number>;
  temas: Map<string, number>;
  momentos: Map<string, number>;
  largo: 'corto' | 'largo' | null;
  estado: Estado | null;
  pesado: number;
  azar: number;
  nombres: Set<string>;
  /** Cuántas cosas se entendieron del texto. */
  senales: number;
}

export class Recomendador {
  /** Lo que se puede recomendar: libros enteros u obras dentro de una antología. */
  private readonly candidatos: { clave: string; libro: Libro; perfil: Perfil; obra?: Obra; grosor: number }[] = [];
  private readonly indiceNombres = new Map<string, Set<string>>();

  constructor(libros: Libro[], perfiles: Record<string, Perfil | string>) {
    for (const libro of libros) {
      const perfil = perfiles[libro.id];
      if (typeof perfil !== 'object') continue;
      if (!perfil.obras?.length) {
        this.candidatos.push({ clave: libro.id, libro, perfil, grosor: libro.grosor });
        continue;
      }
      // Una antología se recomienda obra por obra, cada una con su propio perfil
      perfil.obras.forEach((obra, i) =>
        this.candidatos.push({
          clave: `${libro.id}#${i}`,
          libro,
          obra,
          grosor: GROSOR_OBRA[obra.largo],
          perfil: {
            tonos: obra.tonos,
            temas: [...perfil.temas, ...(obra.temas ?? [])],
            momentos: obra.momentos ?? [],
            pesado: obra.pesado ?? perfil.pesado,
            referencia: perfil.referencia,
            frase: obra.frase,
          },
        }),
      );
    }
    // Autores y palabras distintivas de los títulos (también de cada obra), para «algo de King» o «Rayuela»
    const indexar = (texto: string, clave: string) => {
      for (const p of normalizar(texto).split(' ')) {
        if (p.length < 4 || COMUNES.has(p)) continue;
        const claves = this.indiceNombres.get(p) ?? new Set<string>();
        claves.add(clave);
        this.indiceNombres.set(p, claves);
      }
    };
    for (const c of this.candidatos) {
      indexar(`${c.libro.titulo} ${c.libro.autor}`, c.clave);
      if (c.obra) indexar(c.obra.titulo, c.clave);
    }
    for (const [alias, autor] of [['gabo', 'marquez'], ['lupin', 'leblanc']] as const) {
      const ids = this.indiceNombres.get(autor);
      if (ids) this.indiceNombres.set(alias, ids);
    }
  }

  /** Interpreta el texto libre. */
  private interpretar(texto: string): Pedido {
    const pedido: Pedido = {
      tonos: Object.fromEntries(TONOS.map((t) => [t, 0])) as Record<Tono, number>,
      temas: new Map(),
      momentos: new Map(),
      largo: null,
      estado: null,
      pesado: 0,
      azar: 0,
      nombres: new Set(),
      senales: 0,
    };
    const aplicar = (e: Efecto, negado: boolean) => {
      pedido.senales++;
      const signo = negado ? -0.7 : 1;
      if (e.t) for (const [t, v] of Object.entries(e.t) as [Tono, number][]) pedido.tonos[t] += v * signo;
      if (e.tema) pedido.temas.set(e.tema, (pedido.temas.get(e.tema) ?? 0) + (negado ? -1 : 1));
      if (e.momento) pedido.momentos.set(e.momento, (pedido.momentos.get(e.momento) ?? 0) + (negado ? -1 : 1));
      if (e.largo) pedido.largo = negado ? (e.largo === 'corto' ? 'largo' : 'corto') : e.largo;
      if (e.estado) pedido.estado = negado ? (e.estado === 'releer' ? 'nuevo' : null) : e.estado;
      if (e.azar) pedido.azar = Math.max(pedido.azar, negado ? 0 : e.azar);
      if (negado) {
        // «nada triste», «sin terror»: además de evitar eso, mejor algo no tan duro
        const t = e.t ?? {};
        if ((t.melancolia ?? 0) > 0.4 || (t.oscuro ?? 0) > 0.4 || (t.emocion ?? 0) > 0.4) pedido.pesado -= 0.4;
        else if ((t.liviano ?? 0) > 0.5) pedido.pesado += 0.3;
      } else if (e.pesado) {
        pedido.pesado += e.pesado;
      }
    };

    let resto = ` ${normalizar(texto)} `;
    // 1) Frases (se buscan enteras y se sacan del texto)
    for (const [raices, efecto] of VOCABULARIO) {
      for (const r of raices) {
        if (!r.includes(' ')) continue;
        const buscado = ` ${r} `;
        let i = resto.indexOf(buscado);
        while (i >= 0) {
          const antes = resto.slice(0, i).trim().split(' ').slice(-2);
          aplicar(efecto, antes.some((p) => NEGACIONES.has(p)) && efecto.azar === undefined);
          resto = `${resto.slice(0, i)} | ${resto.slice(i + buscado.length)}`;
          i = resto.indexOf(buscado);
        }
      }
    }
    // 2) Palabra por palabra, con negación hacia adelante («no quiero nada triste»)
    const palabras = resto.trim().split(' ');
    let negacion = 0;
    for (const p of palabras) {
      if (p === '|') {
        negacion = 0;
        continue;
      }
      if (NEGACIONES.has(p)) {
        negacion = 3;
        continue;
      }
      let entendida = false;
      for (const [raices, efecto] of VOCABULARIO) {
        const coincide = raices.some((r) => !r.includes(' ') && (r.startsWith('=') ? p === r.slice(1) : r.length <= p.length && p.startsWith(r)));
        if (coincide) {
          aplicar(efecto, negacion > 0);
          entendida = true;
          break;
        }
      }
      if (!entendida && p.length >= 4 && !COMUNES.has(p)) {
        const ids = this.indiceNombres.get(p);
        if (ids && negacion === 0) {
          ids.forEach((id) => pedido.nombres.add(id));
          pedido.senales++;
        }
      }
      if (negacion > 0) negacion--;
    }
    return pedido;
  }

  /**
   * Devuelve los libros ordenados del más indicado al menos indicado (hasta 8),
   * cada uno con una frase de por qué. `vuelta` cambia un poco el azar para «otro».
   */
  recomendar(texto: string, ctx: ContextoLectura, vuelta = 0, cuales: Cuales = 'todos'): Recomendacion[] {
    const pedido = this.interpretar(texto);
    const azar = rng(hash(`${normalizar(texto)}#${vuelta}#${Math.floor(Date.now() / 3.6e6)}`));
    const noche = ctx.hora >= 22 || ctx.hora < 6;
    const lluvia = ctx.lluvia > 0.25;
    const entendio = pedido.senales > 0;

    // La hora y el clima tiñen un poco la elección (más si el texto no dice mucho)
    const ambiente: Tonos = {};
    const sumar = (t: Tonos) => {
      for (const [k, v] of Object.entries(t) as [Tono, number][]) ambiente[k] = (ambiente[k] ?? 0) + v;
    };
    if (lluvia) sumar({ melancolia: 0.5, poesia: 0.4, calma: 0.4, intriga: 0.3 });
    if (noche) sumar({ calma: 0.5, oscuro: 0.3, liviano: 0.3 });
    else if (ctx.hora >= 6 && ctx.hora < 12) sumar({ impulso: 0.5, aprender: 0.4, pensar: 0.2 });
    else sumar({ liviano: 0.2, aventura: 0.2, intriga: 0.2 });
    const tieneTono = TONOS.some((t) => pedido.tonos[t] !== 0);
    const especifico = tieneTono || pedido.temas.size > 0 || pedido.nombres.size > 0 || pedido.momentos.size > 0;
    // El sentimiento más fuerte que se entendió, para responderle
    const momentoPrincipal = [...pedido.momentos].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const pesoAmbiente = tieneTono ? 0.08 : 0.3;

    const norma = Math.hypot(...TONOS.map((t) => pedido.tonos[t])) || 1;
    const puntuados = this.candidatos
      .filter(({ libro }) => !libro.prestado && (cuales === 'todos' || libro.estado === cuales))
      .map(({ clave, libro, perfil, obra, grosor }) => {
        let tono = 0;
        let mejor: Tono | null = null;
        let mejorValor = 0;
        for (const t of TONOS) {
          const v = (pedido.tonos[t] / norma) * (perfil.tonos[t] ?? 0);
          tono += v;
          if (v > mejorValor) {
            mejorValor = v;
            mejor = t;
          }
        }
        let tema = 0;
        let temaPrincipal: string | null = null;
        for (const [k, w] of pedido.temas) {
          if (!perfil.temas.includes(k)) continue;
          tema += w;
          if (w > 0 && !temaPrincipal) temaPrincipal = k;
        }
        let momento = 0;
        for (const [m, w] of pedido.momentos) if (perfil.momentos?.includes(m)) momento += w;
        const porNombre = pedido.nombres.has(clave);
        let total = tono + tema * 0.9 + momento * 0.9 + (porNombre ? 1.6 : 0);
        if (perfil.referencia && tema <= 0 && !porNombre) total -= 3;

        const g = grosor;
        // Si pidió algo corto (o largo), el grosor pesa en serio: cuanto más se aleja, peor
        if (pedido.largo === 'corto') total += g <= 1.5 ? 0.35 : -(g - 1.5) * 0.6;
        if (pedido.largo === 'largo') total += g >= 2.4 ? 0.35 : -(2.4 - g) * 0.4;
        total += pedido.pesado * (perfil.pesado ?? 0) * 0.8;

        const e = libro.estado ?? null;
        // Con «Cualquiera» la biblioteca prefiere lo empezado y lo no leído
        if (cuales === 'todos') total += e === 'leido' ? -0.35 : e === 'empezado' ? 0.2 : e === 'sin-leer' ? 0.25 : 0;
        if (pedido.estado === 'releer') total += e === 'leido' ? 0.5 : -0.1;
        if (pedido.estado === 'nuevo') total += e === 'sin-leer' ? 0.35 : e === 'leido' ? -0.3 : 0;
        if (pedido.estado === 'retomar') total += e === 'empezado' ? 0.7 : 0;

        for (const t of TONOS) total += (ambiente[t] ?? 0) * (perfil.tonos[t] ?? 0) * pesoAmbiente;
        total += azar() * (0.12 + pedido.azar * 0.9 + (especifico ? 0 : 0.3));

        return { libro, perfil, obra, grosor, total, mejor, temaPrincipal, porNombre, tono, tema };
      })
      .sort((a, b) => b.total - a.total);

    // Variedad: que no salgan tres del mismo autor seguidos
    const elegidos: typeof puntuados = [];
    const restantes = [...puntuados];
    while (elegidos.length < 8 && restantes.length) {
      let mejorI = 0;
      let mejorV = -Infinity;
      restantes.forEach((c, i) => {
        const mismoAutor = elegidos.filter((x) => x.libro.autor === c.libro.autor).length;
        const mismoLibro = elegidos.filter((x) => x.libro === c.libro).length;
        const v = c.total - mismoAutor * 0.45 - mismoLibro * 0.5;
        if (v > mejorV) {
          mejorV = v;
          mejorI = i;
        }
      });
      elegidos.push(restantes.splice(mejorI, 1)[0]);
    }

    return elegidos.map((c) => {
      let intro: string;
      if (c.porNombre) intro = 'Como lo pediste';
      else if (momentoPrincipal) intro = INTRO_MOMENTO[momentoPrincipal] ?? 'Para este momento';
      else if (c.temaPrincipal && c.tema * 0.9 >= c.tono) intro = INTRO_TEMA[c.temaPrincipal] ?? 'Para vos';
      else if (c.mejor) intro = INTRO_TONO[c.mejor]({ lluvia, noche });
      else if (pedido.azar > 0) intro = 'A la suerte';
      else if (pedido.estado === 'releer') intro = 'Para volver a leer';
      else if (pedido.estado === 'retomar') intro = 'Para terminar lo que empezaste';
      else if (pedido.estado === 'nuevo') intro = 'Algo que todavía no leíste';
      else if (pedido.largo === 'corto') intro = 'Cortito, para leer de a ratos';
      else if (pedido.largo === 'largo') intro = 'Para tomarte tu tiempo';
      else if (!entendio && texto.trim()) intro = 'No te entendí del todo, así que elegí yo';
      else intro = noche ? 'Para esta hora de la noche' : lluvia ? 'Para este día de lluvia' : 'Elegido para vos';

      const partes = [c.perfil.frase];
      const e = c.libro.estado;
      const volver = pedido.estado === 'releer' || cuales === 'leido';
      if (c.obra) {
        // Dónde está la obra y cómo va ese libro
        const libro = `«${c.libro.titulo}»`;
        if (e === 'empezado') partes.push(`Está en tu ${libro}, que dejaste por la mitad.`);
        else if (e === 'sin-leer') partes.push(`Está en tu ${libro}, que todavía no empezaste.`);
        else if (e === 'leido') partes.push(`Está en tu ${libro}: ya lo leíste, pero ${volver ? 'es ideal para volver' : 'da para volver'}.`);
        else partes.push(`Está en tu ${libro}.`);
      } else if (e === 'empezado') partes.push('Lo dejaste por la mitad: buen momento para retomarlo.');
      else if (e === 'sin-leer') partes.push('Todavía no lo leíste.');
      else if (e === 'leido') partes.push(volver ? 'Ya lo leíste: ideal para volver.' : 'Ya lo leíste, pero da para volver.');
      if (pedido.largo === 'corto' && c.grosor <= 1.5) partes.push('Es cortito.');
      if (pedido.largo === 'largo' && c.grosor >= 2.4) partes.push('Da para rato.');
      return {
        libro: c.libro,
        obra: c.obra ? { titulo: c.obra.titulo, tipo: c.obra.tipo } : undefined,
        intro,
        porque: partes.join(' '),
      };
    });
  }
}
