function calcDistance(point1, point2) {
	function toRadians(angle) {
		return angle * Math.PI / 180;
	}

	var R = 6371e3;
	var fi1 = toRadians(point1.lat), lambda1 = toRadians(point1.lon);
	var fi2 = toRadians(point2.lat), lambda2 = toRadians(point2.lon);
	var dFi = fi2 - fi1;
	var dLambda = lambda2 - lambda1;

	var a = Math.sin(dFi / 2) * Math.sin(dFi / 2)
		+ Math.cos(fi1) * Math.cos(fi2)
		* Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}
