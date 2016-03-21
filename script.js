$(function () {
    $('body').on('click', '#address_submit', function (e) {
        e.preventDefault();
        $('#address_modal').modal('hide');
        bundle.Main.addAddress($('#address_addr').val(), $('#address_pk').val());
    });
});
$(function () {
    $('body').on('click', '#fund_submit', function (e) {
        e.preventDefault();
        $('#fund_modal').modal('hide');
        bundle.Main.fund($('#fund_amount').val());
    });
});
$(function () {
    $('body').on('click', '#withdraw_submit', function (e) {
        e.preventDefault();
        $('#withdraw_modal').modal('hide');
        bundle.Main.withdraw($('#withdraw_amount').val());
    });
});
$(function () {
    $('body').on('click', '#buy_submit', function (e) {
        e.preventDefault();
        $('#buy_modal').modal('hide');
        bundle.Main.buy($('#buy_order').val(), $('#buy_price').val(), $('#buy_size').val());
    });
    $('#buy_modal').on('show.bs.modal', function(e) {
        var order = JSON.stringify($(e.relatedTarget).data('order'));
        $(e.currentTarget).find('input[id="buy_order"]').val(order);
        var price = $(e.relatedTarget).data('price');
        $(e.currentTarget).find('input[id="buy_price"]').val(price);
        var size = $(e.relatedTarget).data('size');
        $(e.currentTarget).find('input[id="buy_size"]').val(size);
        var description = $(e.relatedTarget).data('description');
        $(e.currentTarget).find('#buy_description').html(description);
    });
});
$(function () {
    $('body').on('click', '#sell_submit', function (e) {
        e.preventDefault();
        $('#sell_modal').modal('hide');
        bundle.Main.sell($('#sell_order').val(), $('#sell_price').val(), $('#sell_size').val());
    });
    $('#sell_modal').on('show.bs.modal', function(e) {
        var order = JSON.stringify($(e.relatedTarget).data('order'));
        $(e.currentTarget).find('input[id="sell_order"]').val(order);
        var price = $(e.relatedTarget).data('price');
        $(e.currentTarget).find('input[id="sell_price"]').val(price);
        var size = $(e.relatedTarget).data('size');
        $(e.currentTarget).find('input[id="sell_size"]').val(size);
        var description = $(e.relatedTarget).data('description');
        $(e.currentTarget).find('#sell_description').html(description);
    });
});
