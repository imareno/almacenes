namespace Almacen.Helpers;

public class DapperDateOnlyHandler : Dapper.SqlMapper.TypeHandler<DateOnly>
{
    public override DateOnly Parse(object value) => value switch
    {
        DateOnly d => d,
        DateTime dt => DateOnly.FromDateTime(dt),
        _ => DateOnly.FromDateTime(Convert.ToDateTime(value))
    };

    public override void SetValue(System.Data.IDbDataParameter parameter, DateOnly value)
    {
        parameter.DbType = System.Data.DbType.Date;
        parameter.Value = value.ToDateTime(TimeOnly.MinValue);
    }
}
