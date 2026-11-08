import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RadioButton, Searchbar } from 'react-native-paper';

import type { Material } from '../api/materiales';
import { radios } from '../tema';

/** Lo que el selector necesita de un material (del catálogo o del paquete de datos sin señal). */
type MaterialElegible = Pick<Material, 'id' | 'codigo' | 'nombre'>;

type Props = {
  materiales: readonly MaterialElegible[];
  valor: string;
  onCambiar: (materialId: string) => void;
  deshabilitado?: boolean;
};

/** Parte del código o del nombre, sin distinguir mayúsculas ni tildes (como la búsqueda del catálogo). */
export function filtrarMateriales<M extends MaterialElegible>(materiales: readonly M[], busqueda: string): M[] {
  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const buscado = normalizar(busqueda.trim());
  if (!buscado) {
    return [...materiales];
  }
  return materiales.filter(
    (material) => normalizar(material.codigo).includes(buscado) || normalizar(material.nombre).includes(buscado),
  );
}

/** Materiales activos del catálogo para elegir uno («CEM-IP30 · Cemento IP-30»), con búsqueda. */
export function SelectorMaterial({ materiales, valor, onCambiar, deshabilitado }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const visibles = useMemo(() => {
    const filtrados = filtrarMateriales(materiales, busqueda);
    // El elegido sigue a la vista aunque la búsqueda ya no lo incluya.
    const elegido = materiales.find((material) => material.id === valor);
    return elegido && !filtrados.includes(elegido) ? [elegido, ...filtrados] : filtrados;
  }, [materiales, busqueda, valor]);

  return (
    <View>
      {materiales.length > 8 ? (
        <Searchbar
          placeholder="Buscar material"
          value={busqueda}
          onChangeText={setBusqueda}
          mode="view"
          style={estilos.busqueda}
          accessibilityLabel="Buscar material"
        />
      ) : null}
      <RadioButton.Group value={valor} onValueChange={onCambiar}>
        {visibles.map((material) => (
          <RadioButton.Item
            key={material.id}
            value={material.id}
            label={`${material.codigo} · ${material.nombre}`}
            disabled={deshabilitado}
            mode="android"
            position="leading"
            labelStyle={estilos.etiqueta}
          />
        ))}
      </RadioButton.Group>
    </View>
  );
}

const estilos = StyleSheet.create({
  busqueda: { borderTopLeftRadius: radios.tarjeta, borderTopRightRadius: radios.tarjeta },
  etiqueta: { textAlign: 'left' },
});
