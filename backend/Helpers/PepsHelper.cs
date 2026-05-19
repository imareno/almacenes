using Dapper;
using System.Data;

namespace Almacen.Helpers;

public record LoteConsumo(int LoteId, decimal Cantidad, decimal CostoUnitario);

public class PepsHelper
{
    /// <summary>
    /// Consume lotes FIFO para una salida. Devuelve los consumos a registrar y
    /// actualiza cantidad_disponible en cada lote dentro de la misma transacción.
    /// Lanza InvalidOperationException si el stock es insuficiente.
    /// </summary>
    public static async Task<List<LoteConsumo>> ConsumirLotesAsync(
        IDbConnection conn,
        IDbTransaction tx,
        int materialId,
        int almacenId,
        decimal cantidadRequerida)
    {
        var lotes = (await conn.QueryAsync<dynamic>(
            @"SELECT id, cantidad_disponible, costo_unitario
              FROM lotes
              WHERE material_id = @materialId
                AND almacen_id  = @almacenId
                AND cantidad_disponible > 0
              ORDER BY fecha_ingreso ASC, id ASC
              FOR UPDATE",
            new { materialId, almacenId },
            transaction: tx)).ToList();

        decimal totalDisponible = lotes.Sum(l => (decimal)l.cantidad_disponible);
        if (totalDisponible < cantidadRequerida)
            throw new InvalidOperationException(
                $"Stock insuficiente. Disponible: {totalDisponible}, Requerido: {cantidadRequerida}");

        var consumos     = new List<LoteConsumo>();
        decimal pendiente = cantidadRequerida;

        foreach (var lote in lotes)
        {
            if (pendiente <= 0) break;

            int     loteId    = (int)lote.id;
            decimal disponible = (decimal)lote.cantidad_disponible;
            decimal costo      = (decimal)lote.costo_unitario;
            decimal consumido  = Math.Min(disponible, pendiente);

            await conn.ExecuteAsync(
                "UPDATE lotes SET cantidad_disponible = cantidad_disponible - @consumido WHERE id = @loteId",
                new { consumido, loteId },
                transaction: tx);

            consumos.Add(new LoteConsumo(loteId, consumido, costo));
            pendiente -= consumido;
        }

        return consumos;
    }

    /// <summary>
    /// Costo promedio ponderado de una lista de consumos PEPS.
    /// </summary>
    public static decimal CostoPonderado(List<LoteConsumo> consumos)
    {
        decimal total    = consumos.Sum(c => c.Cantidad);
        decimal valorado = consumos.Sum(c => c.Cantidad * c.CostoUnitario);
        return total == 0 ? 0 : valorado / total;
    }
}
